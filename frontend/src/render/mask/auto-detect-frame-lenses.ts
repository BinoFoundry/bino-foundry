import { loadImageForProcessing } from "@/render/bead-crop/image-loader";

import { detectLensMaskBitmap, floodFromBorderThroughOpen, splitMergedLensBridge } from "./auto-lens-mask";
import {
  buildComponentLabels,
  componentBitmap,
  labelMaskComponents,
  processLensOpeningContour,
  traceOuterContour,
  type MaskComponent,
} from "./mask-contour";
import {
  createLensPolygon,
  createMaskConfig,
  migrateAnchors,
  type LensPolygon,
  type MaskConfig,
  type PathAnchor,
} from "./mask-types";

export const LENS_DUAL_DETECT_FAILED_MESSAGE =
  "Lens detection could not identify both lens areas. Please define them manually.";

export type FrameLensSide = "left" | "right";

export const LENS_SIDE_LABELS: Record<FrameLensSide, string> = {
  left: "Left lens",
  right: "Right lens",
};

export const LENS_SIDE_DETECT_FAILED: Record<FrameLensSide, string> = {
  left: "No enclosed left lens region detected. Use Edit Left Lens to draw the mask manually.",
  right: "No enclosed right lens region detected. Use Edit Right Lens to draw the mask manually.",
};

const LENS_CONTOUR_DETECT_FAILED: Record<FrameLensSide, string> = {
  left: "Left lens contour detection failed. Try a PNG with transparent lens openings or draw the path manually.",
  right: "Right lens contour detection failed. Try a PNG with transparent lens openings or draw the path manually.",
};

/** @deprecated Use LENS_DUAL_DETECT_FAILED_MESSAGE */
export const LENS_AUTO_DETECT_FAILED_MESSAGE = LENS_DUAL_DETECT_FAILED_MESSAGE;

const MIN_LENS_AREA_RATIO = 0.0035;
const TARGET_CONTOUR_POINTS = 24;

export interface AutoDetectLensResult {
  config: MaskConfig | null;
  detected: boolean;
  message?: string;
  /** 0–1 confidence. High (≥0.7) is usually ready to save; lower still returns editable polygons. */
  confidence?: number;
}

export function isDualLensMaskValid(config: MaskConfig | null | undefined): boolean {
  if (!config?.lenses?.length) return false;
  return isLensSideValid(config, "left") && isLensSideValid(config, "right");
}

export function isLensSideValid(config: MaskConfig | null | undefined, side: FrameLensSide): boolean {
  const lens = config?.lenses?.find((l) => l.id === side);
  return migrateAnchors(lens?.points ?? []).length >= 3;
}

export function hasAnyLensMask(config: MaskConfig | null | undefined): boolean {
  return isLensSideValid(config, "left") || isLensSideValid(config, "right");
}

export function mergeLensSideIntoMask(
  existing: MaskConfig | null | undefined,
  width: number,
  height: number,
  side: FrameLensSide,
  anchors: PathAnchor[],
): MaskConfig {
  const lenses = [
    createLensPolygon("left", LENS_SIDE_LABELS.left, []),
    createLensPolygon("right", LENS_SIDE_LABELS.right, []),
  ].map((def) => {
    const fromExisting = existing?.lenses?.find((l) => l.id === def.id);
    if (def.id === side) {
      return createLensPolygon(side, LENS_SIDE_LABELS[side], anchors);
    }
    return createLensPolygon(
      def.id as FrameLensSide,
      def.label,
      fromExisting?.points ?? [],
    );
  });
  return createMaskConfig(width, height, lenses);
}

function pointsToAnchors(
  points: { x: number; y: number }[],
  width: number,
  height: number,
): PathAnchor[] {
  return points.map((p) => ({
    x: p.x / width,
    y: p.y / height,
    curved: false,
    handleIn: null,
    handleOut: null,
  }));
}

function polygonFromComponentMask(
  componentMask: Uint8Array,
  width: number,
  height: number,
): PathAnchor[] | null {
  const contour = traceOuterContour(componentMask, width, height);
  if (contour.length < 3) return null;
  const processed = processLensOpeningContour(contour, width, height, {
    targetPoints: TARGET_CONTOUR_POINTS,
    smoothPasses: 3,
    minSpacing: Math.max(1, Math.max(width, height) * 0.0025),
  });
  if (processed.points.length < 3) return null;
  return pointsToAnchors(processed.points, width, height);
}

function polygonCentroidX(anchors: PathAnchor[]): number {
  if (!anchors.length) return 0.5;
  return anchors.reduce((s, p) => s + p.x, 0) / anchors.length;
}

/**
 * Final left/right assignment is always by centroid X — never by detection order.
 * Smaller X → left lens, larger X → right lens.
 */
export function assignAnchorsByCentroidX(
  a: PathAnchor[] | undefined,
  b: PathAnchor[] | undefined,
): { left?: PathAnchor[]; right?: PathAnchor[] } {
  const valid = [a, b].filter((p): p is PathAnchor[] => Boolean(p && p.length >= 3));
  if (valid.length === 0) return {};
  if (valid.length === 1) {
    const only = valid[0]!;
    return polygonCentroidX(only) < 0.5 ? { left: only } : { right: only };
  }
  const sorted = [...valid].sort((p, q) => polygonCentroidX(p) - polygonCentroidX(q));
  return { left: sorted[0], right: sorted[1] };
}

/** Prefer enclosed lens-sized openings; rank rather than hard-reject borderline blobs. */
function pickLeftRightComponents(
  components: MaskComponent[],
  width: number,
  height: number,
  minPixels: number,
): { left?: MaskComponent; right?: MaskComponent } {
  const imageArea = width * height;
  const eligible = components
    .filter((c) => c.size >= minPixels)
    .map((c) => {
      const frac = c.size / imageArea;
      const sizeScore =
        frac >= 0.006 && frac <= 0.16
          ? 1
          : frac < 0.006
            ? frac / 0.006
            : Math.max(0.08, 1 - (frac - 0.16) / 0.4);
      const cy = c.centroidY / height;
      const verticalScore = cy >= 0.15 && cy <= 0.85 ? 1 : 0.4;
      // Soft penalty for huge blobs — still usable as a starting polygon.
      const hugePenalty = frac > 0.35 ? 0.25 : 1;
      return { ...c, score: (sizeScore * 0.7 + verticalScore * 0.3) * hugePenalty, frac };
    })
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score || b.size - a.size);

  if (eligible.length >= 2) {
    // Always take top candidates then sort by centroid X — never trust detection order.
    const mid = width / 2;
    const leftCandidates = eligible.filter((c) => c.centroidX < mid);
    const rightCandidates = eligible.filter((c) => c.centroidX >= mid);
    if (leftCandidates.length && rightCandidates.length) {
      const pair = [leftCandidates[0]!, rightCandidates[0]!].sort(
        (a, b) => a.centroidX - b.centroidX,
      );
      return { left: pair[0], right: pair[1] };
    }
    const ordered = eligible.slice(0, 2).sort((a, b) => a.centroidX - b.centroidX);
    return { left: ordered[0], right: ordered[1] };
  }

  if (eligible.length === 1) {
    const only = eligible[0]!;
    const midX = width / 2;
    if (only.centroidX < midX) return { left: only };
    return { right: only };
  }

  return {};
}

/**
 * Transparent cut-outs that are enclosed (not connected to the image border).
 * Exterior transparency is discarded so we never select the outer plate hole.
 */
function buildEnclosedAlphaHoleMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMax = 14,
): Uint8Array {
  const transparent = new Uint8Array(width * height);
  for (let idx = 0; idx < transparent.length; idx++) {
    if (data[idx * 4 + 3]! <= alphaMax) transparent[idx] = 1;
  }
  // Wall = opaque pixels. Flood from border through transparent → exterior air.
  const wall = new Uint8Array(transparent.length);
  for (let idx = 0; idx < wall.length; idx++) {
    wall[idx] = transparent[idx] ? 0 : 1;
  }
  const exterior = floodFromBorderThroughOpen(wall, width, height);
  const enclosed = new Uint8Array(transparent.length);
  for (let idx = 0; idx < enclosed.length; idx++) {
    if (transparent[idx] && !exterior[idx]) enclosed[idx] = 1;
  }
  return enclosed;
}

function buildAlphaHoleMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMax = 14,
): Uint8Array {
  return buildEnclosedAlphaHoleMask(data, width, height, alphaMax);
}

function splitMaskHalves(
  mask: Uint8Array,
  width: number,
  height: number,
): { left: Uint8Array; right: Uint8Array } {
  const left = new Uint8Array(mask.length);
  const right = new Uint8Array(mask.length);
  const midX = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      if (x < midX) left[idx] = 1;
      else right[idx] = 1;
    }
  }
  return { left, right };
}

function largestComponentInMask(
  mask: Uint8Array,
  width: number,
  height: number,
  minPixels: number,
): MaskComponent | undefined {
  return labelMaskComponents(mask, width, height)
    .filter((c) => c.size >= minPixels)
    .sort((a, b) => b.size - a.size)[0];
}

function componentTouchesImageBorder(
  labels: Int32Array,
  componentId: number,
  width: number,
  height: number,
): boolean {
  for (let x = 0; x < width; x++) {
    if (labels[x] === componentId || labels[(height - 1) * width + x] === componentId) return true;
  }
  for (let y = 0; y < height; y++) {
    if (labels[y * width] === componentId || labels[y * width + (width - 1)] === componentId) {
      return true;
    }
  }
  return false;
}

function anchorsFromComponent(
  bitmap: Uint8Array,
  labels: Int32Array,
  width: number,
  height: number,
  componentId: number,
): PathAnchor[] | null {
  const compMask = componentBitmap(bitmap, labels, width, height, componentId);
  return polygonFromComponentMask(compMask, width, height);
}

function prepareLensBitmap(bitmap: Uint8Array, width: number, height: number): Uint8Array {
  let prepared = splitMergedLensBridge(bitmap, width, height, 0.07);
  prepared = splitMergedLensBridge(prepared, width, height, 0.045);
  return prepared;
}

/** Exported for unit tests — builds L/R polygons from a binary lens mask. */
export function detectLensAnchorsFromBitmap(
  bitmap: Uint8Array,
  width: number,
  height: number,
): { left?: PathAnchor[]; right?: PathAnchor[]; regionCount: number } {
  const prepared = prepareLensBitmap(bitmap, width, height);
  const minPixels = width * height * MIN_LENS_AREA_RATIO;
  const labels = buildComponentLabels(prepared, width, height);
  const components = labelMaskComponents(prepared, width, height).filter(
    (c) => !componentTouchesImageBorder(labels, c.id, width, height),
  );
  const regionCount = components.filter((c) => c.size >= minPixels).length;

  let { left: leftComp, right: rightComp } = pickLeftRightComponents(
    components,
    width,
    height,
    minPixels,
  );

  const collected: PathAnchor[] = [];

  if (leftComp) {
    const anchors = anchorsFromComponent(prepared, labels, width, height, leftComp.id);
    if (anchors) collected.push(anchors);
  }
  if (rightComp) {
    const anchors = anchorsFromComponent(prepared, labels, width, height, rightComp.id);
    if (anchors) collected.push(anchors);
  }

  if (collected.length < 2) {
    // Soft last resort: take the two strongest interior blobs even if scoring was weak.
    const soft = [...components].sort((a, b) => b.size - a.size);
    for (const c of soft) {
      if (collected.length >= 2) break;
      const anchors = anchorsFromComponent(prepared, labels, width, height, c.id);
      if (!anchors) continue;
      // Skip duplicates of an already chosen component polygon (same centroid-ish).
      const cx = polygonCentroidX(anchors);
      if (collected.some((p) => Math.abs(polygonCentroidX(p) - cx) < 0.04)) continue;
      collected.push(anchors);
    }
  }

  if (collected.length < 2) {
    const halves = splitMaskHalves(prepared, width, height);
    if (collected.length < 2) {
      const leftCompHalf = largestComponentInMask(halves.left, width, height, minPixels);
      if (leftCompHalf) {
        const halfLabels = buildComponentLabels(halves.left, width, height);
        const anchors = anchorsFromComponent(halves.left, halfLabels, width, height, leftCompHalf.id);
        if (anchors) {
          const cx = polygonCentroidX(anchors);
          if (!collected.some((p) => Math.abs(polygonCentroidX(p) - cx) < 0.04)) {
            collected.push(anchors);
          }
        }
      }
    }
    if (collected.length < 2) {
      const rightCompHalf = largestComponentInMask(halves.right, width, height, minPixels);
      if (rightCompHalf) {
        const halfLabels = buildComponentLabels(halves.right, width, height);
        const anchors = anchorsFromComponent(
          halves.right,
          halfLabels,
          width,
          height,
          rightCompHalf.id,
        );
        if (anchors) {
          const cx = polygonCentroidX(anchors);
          if (!collected.some((p) => Math.abs(polygonCentroidX(p) - cx) < 0.04)) {
            collected.push(anchors);
          }
        }
      }
    }
  }

  const assigned = assignAnchorsByCentroidX(collected[0], collected[1]);
  return { ...assigned, regionCount };
}

function sourceDimensions(source: HTMLImageElement | HTMLCanvasElement): {
  width: number;
  height: number;
} {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  return { width, height };
}

function countMaskPixels(mask: Uint8Array): number {
  let count = 0;
  for (let idx = 0; idx < mask.length; idx++) {
    if (mask[idx]) count += 1;
  }
  return count;
}

function readImageRgba(source: HTMLImageElement | HTMLCanvasElement): Uint8ClampedArray {
  const { width, height } = sourceDimensions(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, width, height).data;
}

function polygonBounds(anchors: PathAnchor[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  area: number;
  cx: number;
} {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let sx = 0;
  let sy = 0;
  for (const p of anchors) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    sx += p.x;
    sy += p.y;
  }
  const w = Math.max(0, maxX - minX);
  const h = Math.max(0, maxY - minY);
  return {
    minX,
    maxX,
    minY,
    maxY,
    area: w * h,
    cx: anchors.length ? sx / anchors.length : 0.5,
  };
}

/** Score a dual-lens proposal (higher = better). Rejects outer-frame sized polygons. */
function scoreDualAnchors(
  left: PathAnchor[] | undefined,
  right: PathAnchor[] | undefined,
): number {
  if (!left || !right || left.length < 3 || right.length < 3) return 0;
  const lb = polygonBounds(left);
  const rb = polygonBounds(right);
  if (lb.cx >= rb.cx) return 0.05;
  // Outer silhouette polygons are large — treat as near-failure.
  if (lb.area > 0.28 || rb.area > 0.28) return 0.08;
  if (lb.area < 0.004 || rb.area < 0.004) return 0.1;

  const areaBalance = 1 - Math.min(1, Math.abs(lb.area - rb.area) / Math.max(lb.area, rb.area, 1e-6));
  const separation = Math.min(1, Math.max(0, rb.minX - lb.maxX) * 4 + (rb.cx - lb.cx));
  const sizeScore = Math.min(1, (lb.area + rb.area) * 5);
  const compactness =
    lb.area < 0.18 && rb.area < 0.18 ? 1 : Math.max(0, 1 - (Math.max(lb.area, rb.area) - 0.18) / 0.15);
  const pointScore = Math.min(1, (left.length + right.length) / 40);
  return (
    areaBalance * 0.3 + separation * 0.3 + sizeScore * 0.15 + compactness * 0.15 + pointScore * 0.1
  );
}

function confidenceFromScore(score: number, bothSides: boolean): number {
  if (!bothSides) return Math.max(0.15, score * 0.5);
  return Math.max(0.25, Math.min(0.98, score));
}

function detectSideFromAlphaHoles(
  source: HTMLImageElement | HTMLCanvasElement,
  side: FrameLensSide,
  width: number,
  height: number,
): PathAnchor[] | null {
  const rgba = readImageRgba(source);
  const holeMask = buildAlphaHoleMask(rgba, width, height);
  const minHolePixels = width * height * 0.002;
  if (countMaskPixels(holeMask) < minHolePixels) return null;
  const anchorMap = detectLensAnchorsFromBitmap(holeMask, width, height);
  return anchorMap[side] ?? null;
}

/**
 * Approximate left/right lens ellipses from frame geometry.
 * Used when contour detection fails — always gives editable starting points.
 */
export function estimateLensPolygonsFromGeometry(
  width: number,
  height: number,
  frameBox?: { x: number; y: number; w: number; h: number },
): { left: PathAnchor[]; right: PathAnchor[] } {
  const box = frameBox ?? { x: width * 0.08, y: height * 0.18, w: width * 0.84, h: height * 0.55 };
  const rx = Math.max(8, box.w * 0.18);
  const ry = Math.max(8, box.h * 0.32);
  const cy = box.y + box.h * 0.48;
  const leftCx = box.x + box.w * 0.28;
  const rightCx = box.x + box.w * 0.72;
  return {
    left: ellipseAnchorsNormalized(leftCx, cy, rx, ry, width, height, 20),
    right: ellipseAnchorsNormalized(rightCx, cy, rx, ry, width, height, 20),
  };
}

function ellipseAnchorsNormalized(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  height: number,
  segments: number,
): PathAnchor[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(t) * rx,
      y: cy + Math.sin(t) * ry,
    });
  }
  return pointsToAnchors(points, width, height);
}

function estimateFrameBoxFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  const labelY = height * 0.89;
  for (let y = 0; y < height; y++) {
    if (y >= labelY) continue;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a < 10) continue;
      const l = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      if (l > 245) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!found) {
    return { x: width * 0.1, y: height * 0.2, w: width * 0.8, h: height * 0.5 };
  }
  const padX = Math.round((maxX - minX) * 0.02);
  const padY = Math.round((maxY - minY) * 0.03);
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    w: Math.min(width, maxX - minX + 1 + padX * 2),
    h: Math.min(height, maxY - minY + 1 + padY * 2),
  };
}

/**
 * Detect independent left/right lens openings from a frame plate.
 * Always returns editable polygons for valid images — approximate geometry when needed.
 */
export function detectFrameLensMaskFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
): AutoDetectLensResult {
  const { width, height } = sourceDimensions(source);
  if (width <= 0 || height <= 0) {
    return { config: null, detected: false, message: LENS_DUAL_DETECT_FAILED_MESSAGE, confidence: 0 };
  }

  let classifierMap: { left?: PathAnchor[]; right?: PathAnchor[]; regionCount: number } = {
    regionCount: 0,
  };
  let alphaMap: { left?: PathAnchor[]; right?: PathAnchor[]; regionCount: number } = {
    regionCount: 0,
  };
  let frameBox: { x: number; y: number; w: number; h: number } | undefined;

  try {
    const { bitmap } = detectLensMaskBitmap(source);
    classifierMap = detectLensAnchorsFromBitmap(bitmap, width, height);
  } catch {
    /* continue with alpha / geometry */
  }

  try {
    const rgba = readImageRgba(source);
    frameBox = estimateFrameBoxFromRgba(rgba, width, height);
    const holeMask = buildAlphaHoleMask(rgba, width, height);
    if (countMaskPixels(holeMask) >= width * height * 0.001) {
      alphaMap = detectLensAnchorsFromBitmap(holeMask, width, height);
    }
  } catch {
    /* keep classifier */
  }

  const classifierScore = scoreDualAnchors(classifierMap.left, classifierMap.right);
  const alphaScore = scoreDualAnchors(alphaMap.left, alphaMap.right);

  const preferAlpha = alphaScore >= classifierScore && alphaScore > 0;
  const primary = preferAlpha ? alphaMap : classifierMap;
  const secondary = preferAlpha ? classifierMap : alphaMap;

  let left = primary.left ?? secondary.left;
  let right = primary.right ?? secondary.right;
  // Always re-assign by centroid X after fusing sources.
  ({ left, right } = assignAnchorsByCentroidX(left, right));
  let score = scoreDualAnchors(left, right);
  let usedEstimate = false;

  if (!left || left.length < 3 || !right || right.length < 3) {
    const estimated = estimateLensPolygonsFromGeometry(width, height, frameBox);
    if (!left || left.length < 3) left = estimated.left;
    if (!right || right.length < 3) right = estimated.right;
    ({ left, right } = assignAnchorsByCentroidX(left, right));
    usedEstimate = true;
    score = Math.max(score, 0.28);
  } else {
    // Final guard — never ship swapped sides.
    ({ left, right } = assignAnchorsByCentroidX(left, right));
  }

  const both = Boolean(left && right && left.length >= 3 && right.length >= 3);
  const confidence = usedEstimate
    ? Math.min(0.45, confidenceFromScore(score, both))
    : confidenceFromScore(score, both);

  const lenses: LensPolygon[] = [
    createLensPolygon("left", "Left lens", left ?? []),
    createLensPolygon("right", "Right lens", right ?? []),
  ];
  const config = createMaskConfig(width, height, lenses);

  if (!both) {
    // Should be unreachable after geometry fill — keep defensive return.
    return {
      config,
      detected: false,
      confidence,
      message: LENS_DUAL_DETECT_FAILED_MESSAGE,
    };
  }

  let message: string | undefined;
  if (usedEstimate) {
    message =
      "Approximate lens polygons added — drag the points to match each opening, then save.";
  } else if (confidence < 0.7) {
    message = "Lenses detected with medium confidence — review and adjust before saving.";
  }

  return {
    config,
    detected: true,
    confidence,
    message,
  };
}

export interface DetectLensSideResult {
  anchors: PathAnchor[] | null;
  detected: boolean;
  message?: string;
  confidence?: number;
  diagnostics?: LensSideDetectDiagnostics;
}

export interface LensSideDetectDiagnostics {
  imageWidth: number;
  imageHeight: number;
  imageSource: "alpha-holes" | "classifier" | "fused" | "none";
  alphaHolePixels: number;
  regionCount: number;
  pointCount: number;
  confidence: number;
}

function countEligibleRegions(bitmap: Uint8Array, width: number, height: number): number {
  const minPixels = width * height * MIN_LENS_AREA_RATIO;
  return labelMaskComponents(bitmap, width, height).filter((c) => c.size >= minPixels).length;
}

function formatDetectDiagnostics(diag: LensSideDetectDiagnostics): string {
  return `${diag.imageWidth}×${diag.imageHeight}px · ${diag.regionCount} region(s) · ${diag.pointCount} path point(s) · conf ${diag.confidence.toFixed(2)} · via ${diag.imageSource}`;
}

/** Detect anchors for a single lens (left or right) from a frame plate. */
export function detectFrameLensSideFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
  side: FrameLensSide,
): DetectLensSideResult {
  const dual = detectFrameLensMaskFromSource(source);
  const { width, height } = sourceDimensions(source);

  if (width <= 0 || height <= 0) {
    return {
      anchors: null,
      detected: false,
      confidence: 0,
      message: LENS_CONTOUR_DETECT_FAILED[side],
      diagnostics: {
        imageWidth: width,
        imageHeight: height,
        imageSource: "none",
        alphaHolePixels: 0,
        regionCount: 0,
        pointCount: 0,
        confidence: 0,
      },
    };
  }

  let alphaHolePixels = 0;
  let regionCount = 0;
  let imageSource: LensSideDetectDiagnostics["imageSource"] = "none";
  let anchors: PathAnchor[] | null = null;

  try {
    const rgba = readImageRgba(source);
    const holeMask = buildAlphaHoleMask(rgba, width, height);
    alphaHolePixels = countMaskPixels(holeMask);
    regionCount = countEligibleRegions(holeMask, width, height);
  } catch {
    /* ignore */
  }

  if (dual.config) {
    const lens = dual.config.lenses.find((l) => l.id === side);
    const pts = migrateAnchors(lens?.points ?? []);
    if (pts.length >= 3) {
      anchors = pts;
      imageSource = "fused";
    }
  }

  if (!anchors) {
    anchors = detectSideFromAlphaHoles(source, side, width, height);
    if (anchors) imageSource = "alpha-holes";
  }

  if (!anchors) {
    try {
      const { bitmap } = detectLensMaskBitmap(source);
      regionCount = Math.max(regionCount, countEligibleRegions(bitmap, width, height));
      const map = detectLensAnchorsFromBitmap(bitmap, width, height);
      anchors = map[side] ?? null;
      if (anchors) imageSource = "classifier";
    } catch {
      /* keep null */
    }
  }

  if (!anchors || anchors.length < 3) {
    const estimated = estimateLensPolygonsFromGeometry(width, height);
    anchors = estimated[side];
    imageSource = "fused";
  }

  const pointCount = anchors ? migrateAnchors(anchors).length : 0;
  const confidence = dual.confidence ?? (pointCount >= 3 ? 0.4 : 0);
  const diagnostics: LensSideDetectDiagnostics = {
    imageWidth: width,
    imageHeight: height,
    imageSource,
    alphaHolePixels,
    regionCount,
    pointCount,
    confidence,
  };

  if (!anchors || pointCount < 3) {
    return {
      anchors: null,
      detected: false,
      confidence: 0,
      message: LENS_SIDE_DETECT_FAILED[side],
      diagnostics,
    };
  }

  if (import.meta.env.DEV) {
    console.info(`[lens-detect:${side}]`, formatDetectDiagnostics(diagnostics));
  }

  return {
    anchors,
    detected: true,
    confidence,
    diagnostics,
    message: dual.message,
  };
}

export async function detectFrameLensSideFromUrl(
  plateUrl: string,
  side: FrameLensSide,
): Promise<DetectLensSideResult> {
  try {
    const img = await loadImageForProcessing(plateUrl);
    return detectFrameLensSideFromSource(img, side);
  } catch (err) {
    const message =
      err instanceof Error && /fetch|load/i.test(err.message)
        ? "Could not load the plate image for lens detection. Check the image URL or try again."
        : LENS_SIDE_DETECT_FAILED[side];
    return { anchors: null, detected: false, confidence: 0, message };
  }
}

export async function detectFrameLensMaskFromUrl(plateUrl: string): Promise<AutoDetectLensResult> {
  try {
    const img = await loadImageForProcessing(plateUrl);
    return detectFrameLensMaskFromSource(img);
  } catch (err) {
    const message =
      err instanceof Error && /fetch|load/i.test(err.message)
        ? "Could not load the plate image for lens detection. Check the image URL or try again."
        : LENS_DUAL_DETECT_FAILED_MESSAGE;
    return { config: null, detected: false, confidence: 0, message };
  }
}
