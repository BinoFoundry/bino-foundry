import { loadImageForProcessing } from "@/render/bead-crop/image-loader";

import { detectLensMaskBitmap } from "./auto-lens-mask";
import {
  buildComponentLabels,
  componentBitmap,
  labelMaskComponents,
  simplifyContourToPolygon,
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

const MIN_LENS_AREA_RATIO = 0.004;
const TARGET_CONTOUR_POINTS = 22;

export interface AutoDetectLensResult {
  config: MaskConfig | null;
  detected: boolean;
  message?: string;
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
  const simplified = simplifyContourToPolygon(
    contour,
    TARGET_CONTOUR_POINTS,
    Math.max(width, height),
  );
  if (simplified.length < 3) return null;
  return pointsToAnchors(simplified, width, height);
}

function pickLeftRightComponents(
  components: MaskComponent[],
  width: number,
  minPixels: number,
): { left?: MaskComponent; right?: MaskComponent } {
  const eligible = components.filter((c) => c.size >= minPixels);
  const midX = width / 2;
  const left = [...eligible.filter((c) => c.centroidX < midX)].sort((a, b) => b.size - a.size)[0];
  const right = [...eligible.filter((c) => c.centroidX >= midX)].sort((a, b) => b.size - a.size)[0];
  return { left, right };
}

function buildAlphaHoleMask(data: Uint8ClampedArray, width: number, height: number, alphaMax = 14): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let idx = 0; idx < mask.length; idx++) {
    if (data[idx * 4 + 3]! <= alphaMax) mask[idx] = 1;
  }
  return mask;
}

function splitMaskHalves(mask: Uint8Array, width: number, height: number): { left: Uint8Array; right: Uint8Array } {
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

function detectLensAnchorsFromBitmap(
  bitmap: Uint8Array,
  width: number,
  height: number,
): { left?: PathAnchor[]; right?: PathAnchor[] } {
  const minPixels = width * height * MIN_LENS_AREA_RATIO;
  const labels = buildComponentLabels(bitmap, width, height);
  const components = labelMaskComponents(bitmap, width, height);

  let { left: leftComp, right: rightComp } = pickLeftRightComponents(components, width, minPixels);

  if ((!leftComp || !rightComp) && components.length === 1 && components[0]!.size >= minPixels * 2) {
    const halves = splitMaskHalves(bitmap, width, height);
    leftComp = leftComp ?? largestComponentInMask(halves.left, width, height, minPixels);
    rightComp = rightComp ?? largestComponentInMask(halves.right, width, height, minPixels);
  }

  const anchorMap: { left?: PathAnchor[]; right?: PathAnchor[] } = {};
  if (leftComp) {
    const anchors = anchorsFromComponent(bitmap, labels, width, height, leftComp.id);
    if (anchors) anchorMap.left = anchors;
  }
  if (rightComp) {
    const anchors = anchorsFromComponent(bitmap, labels, width, height, rightComp.id);
    if (anchors) anchorMap.right = anchors;
  }
  return anchorMap;
}

function sourceDimensions(source: HTMLImageElement | HTMLCanvasElement): { width: number; height: number } {
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
 * Detect independent left/right lens openings from a frame plate.
 * Uses classifier bitmap first, then transparent-hole analysis as fallback.
 */
export function detectFrameLensMaskFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
): AutoDetectLensResult {
  const { bitmap, width, height } = detectLensMaskBitmap(source);
  if (width <= 0 || height <= 0) {
    return { config: null, detected: false, message: LENS_DUAL_DETECT_FAILED_MESSAGE };
  }

  let anchorMap = detectLensAnchorsFromBitmap(bitmap, width, height);

  if (!anchorMap.left || !anchorMap.right) {
    try {
      const rgba = readImageRgba(source);
      const holeMask = buildAlphaHoleMask(rgba, width, height);
      const holeAnchors = detectLensAnchorsFromBitmap(holeMask, width, height);
      anchorMap = {
        left: anchorMap.left ?? holeAnchors.left,
        right: anchorMap.right ?? holeAnchors.right,
      };
    } catch {
      /* keep classifier result */
    }
  }

  const lenses: LensPolygon[] = [
    createLensPolygon("left", "Left lens", anchorMap.left ?? []),
    createLensPolygon("right", "Right lens", anchorMap.right ?? []),
  ];
  const config = createMaskConfig(width, height, lenses);

  if (!isDualLensMaskValid(config)) {
    return { config: null, detected: false, message: LENS_DUAL_DETECT_FAILED_MESSAGE };
  }

  return { config, detected: true };
}

export interface DetectLensSideResult {
  anchors: PathAnchor[] | null;
  detected: boolean;
  message?: string;
  diagnostics?: LensSideDetectDiagnostics;
}

export interface LensSideDetectDiagnostics {
  imageWidth: number;
  imageHeight: number;
  imageSource: "alpha-holes" | "classifier" | "none";
  alphaHolePixels: number;
  regionCount: number;
  pointCount: number;
}

function countEligibleRegions(bitmap: Uint8Array, width: number, height: number): number {
  const minPixels = width * height * MIN_LENS_AREA_RATIO;
  return labelMaskComponents(bitmap, width, height).filter((c) => c.size >= minPixels).length;
}

function formatDetectDiagnostics(diag: LensSideDetectDiagnostics): string {
  return `${diag.imageWidth}×${diag.imageHeight}px · ${diag.regionCount} region(s) · ${diag.pointCount} path point(s) · via ${diag.imageSource}`;
}

/** Detect anchors for a single lens (left or right) from a frame plate. */
export function detectFrameLensSideFromSource(
  source: HTMLImageElement | HTMLCanvasElement,
  side: FrameLensSide,
): DetectLensSideResult {
  const { width, height } = sourceDimensions(source);
  if (width <= 0 || height <= 0) {
    return {
      anchors: null,
      detected: false,
      message: LENS_CONTOUR_DETECT_FAILED[side],
      diagnostics: {
        imageWidth: width,
        imageHeight: height,
        imageSource: "none",
        alphaHolePixels: 0,
        regionCount: 0,
        pointCount: 0,
      },
    };
  }

  let anchors: PathAnchor[] | null = null;
  let imageSource: LensSideDetectDiagnostics["imageSource"] = "none";
  let alphaHolePixels = 0;
  let regionCount = 0;

  try {
    const rgba = readImageRgba(source);
    const holeMask = buildAlphaHoleMask(rgba, width, height);
    alphaHolePixels = countMaskPixels(holeMask);
    regionCount = countEligibleRegions(holeMask, width, height);
    anchors = detectSideFromAlphaHoles(source, side, width, height);
    if (anchors) imageSource = "alpha-holes";
  } catch {
    /* fall through to classifier */
  }

  if (!anchors) {
    const { bitmap } = detectLensMaskBitmap(source);
    regionCount = countEligibleRegions(bitmap, width, height);
    const anchorMap = detectLensAnchorsFromBitmap(bitmap, width, height);
    anchors = anchorMap[side] ?? null;
    if (anchors) imageSource = "classifier";
  }

  const pointCount = anchors ? migrateAnchors(anchors).length : 0;
  const diagnostics: LensSideDetectDiagnostics = {
    imageWidth: width,
    imageHeight: height,
    imageSource,
    alphaHolePixels,
    regionCount,
    pointCount,
  };

  if (!anchors || pointCount < 3) {
    const noRegions = regionCount === 0 && alphaHolePixels === 0;
    const message = noRegions
      ? "Frame image has no detectable lens opening. Use a PNG with transparent lens cut-outs or draw the path manually."
      : LENS_SIDE_DETECT_FAILED[side];
    return {
      anchors: null,
      detected: false,
      message,
      diagnostics,
    };
  }

  if (import.meta.env.DEV) {
    console.info(`[lens-detect:${side}]`, formatDetectDiagnostics(diagnostics));
  }

  return { anchors, detected: true, diagnostics };
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
    return { anchors: null, detected: false, message };
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
    return { config: null, detected: false, message };
  }
}
