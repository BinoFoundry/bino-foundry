/**
 * Smart Cutout detection — lightweight region-growing + contour (no AI).
 * Admin Editor only; builder consumes saved Manual Detail / hole geometry.
 */

import { createLensPolygon, migrateAnchors, type LensPolygon, type PathAnchor } from "./mask-types";
import {
  buildComponentLabels,
  componentBitmap,
  labelMaskComponents,
  processSilhouetteContour,
  traceOuterContour,
  type ContourPoint,
} from "./mask-contour";

export type SmartCutoutMode = "click" | "brush";

export interface SmartCutoutParams {
  /** Colour distance 0–255 (RGB Euclidean). Default 28. */
  tolerance: number;
  /** Morphological expand in px (≥ 0). Default 0. */
  expand: number;
  /** Morphological shrink in px (≥ 0). Default 0. */
  shrink: number;
  /** Extra dilate after expand/shrink (may be fractional; rounded for morphology). Default 1. */
  feather: number;
  /** Chaikin smooth passes on contour (0–3). Default 1. */
  smoothEdge: number;
  /** Max region size as fraction of image area (safety). Default 0.08. */
  maxAreaFraction?: number;
  /** Min region pixels. Default 12. */
  minAreaPx?: number;
}

/** Per-cutout detection settings (never frame-global). */
export type CutoutDetectSettings = Pick<
  SmartCutoutParams,
  "tolerance" | "expand" | "shrink" | "feather" | "smoothEdge"
>;

export const DEFAULT_CUTOUT_DETECT_SETTINGS: CutoutDetectSettings = {
  tolerance: 28,
  /** Default +1px border (formerly feather: 1). */
  expand: 1,
  shrink: 0,
  feather: 0,
  smoothEdge: 1,
};

export interface SmartCutoutSeed {
  /** Pixel x (image space). */
  x: number;
  /** Pixel y (image space). */
  y: number;
}

export interface SmartCutoutResult {
  ok: true;
  mask: Uint8Array;
  /** Core mask before expand/feather (for Add/Remove Area session). */
  coreMask: Uint8Array;
  width: number;
  height: number;
  areaPx: number;
  /** Contour of the primary (largest) component. */
  contourPx: ContourPoint[];
  /** Normalized anchors for the primary island. */
  points: PathAnchor[];
  /** Additional disconnected islands (normalized). */
  regions: PathAnchor[][];
  seeds: SmartCutoutSeed[];
  params: SmartCutoutParams;
}

export interface SmartCutoutFailure {
  ok: false;
  reason: string;
}

export type SmartCutoutDetectResult = SmartCutoutResult | SmartCutoutFailure;

export const DEFAULT_SMART_CUTOUT_PARAMS: SmartCutoutParams = {
  ...DEFAULT_CUTOUT_DETECT_SETTINGS,
  maxAreaFraction: 0.08,
  minAreaPx: 12,
};

/** Net morphological radius: expand − shrink. */
export function netExpandPx(params: Pick<SmartCutoutParams, "expand" | "shrink">): number {
  return Math.round(Math.max(0, params.expand)) - Math.round(Math.max(0, params.shrink));
}

/**
 * Effective selection border in px (expand − shrink + feather).
 * Used by the consolidated Border size control in admin UI.
 */
export function detectBorderPx(
  settings: Pick<CutoutDetectSettings, "expand" | "shrink" | "feather">,
): number {
  const net = netExpandPx(settings) + Math.round(Math.max(0, settings.feather));
  return Math.max(-8, Math.min(8, net));
}

/**
 * Encode a single Border size slider into expand / shrink / feather.
 * Feather is cleared — net effect is applied as expand or shrink only.
 */
export function withDetectBorderPx(
  settings: CutoutDetectSettings,
  borderPx: number,
): CutoutDetectSettings {
  const b = Math.max(-8, Math.min(8, Math.round(borderPx)));
  return clampCutoutDetectSettings({
    ...settings,
    expand: b > 0 ? b : 0,
    shrink: b < 0 ? -b : 0,
    feather: 0,
  });
}

export function clampCutoutDetectSettings(
  partial: Partial<CutoutDetectSettings> | null | undefined,
): CutoutDetectSettings {
  const src = { ...DEFAULT_CUTOUT_DETECT_SETTINGS, ...partial };
  return {
    tolerance: Math.max(8, Math.min(90, Math.round(src.tolerance))),
    expand: Math.max(0, Math.min(8, Math.round(src.expand))),
    shrink: Math.max(0, Math.min(8, Math.round(src.shrink))),
    feather: Math.max(0, Math.min(8, Math.round(src.feather * 10) / 10)),
    smoothEdge: Math.max(0, Math.min(3, Math.round(src.smoothEdge))),
  };
}

function colourDist(
  data: Uint8ClampedArray,
  idx: number,
  r0: number,
  g0: number,
  b0: number,
): number {
  const i = idx * 4;
  const dr = data[i]! - r0;
  const dg = data[i + 1]! - g0;
  const db = data[i + 2]! - b0;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function maskArea(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n += 1;
  return n;
}

export function unionMasks(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.max(a.length, b.length));
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) out[i] = a[i] || b[i] ? 1 : 0;
  return out;
}

export function subtractMasks(base: Uint8Array, cut: Uint8Array): Uint8Array {
  const out = new Uint8Array(base.length);
  const n = Math.min(base.length, cut.length);
  for (let i = 0; i < n; i++) out[i] = base[i] && !cut[i] ? 1 : 0;
  return out;
}

/** 4-connected region grow from seed using RGB colour tolerance. */
export function regionGrowFromSeed(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  maxAreaPx: number,
): { mask: Uint8Array; areaPx: number } | null {
  const { width, height, data } = imageData;
  const sx = Math.round(seedX);
  const sy = Math.round(seedY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;

  const seedIdx = sy * width + sx;
  const a = data[seedIdx * 4 + 3]!;
  if (a < 8) return null;

  const r0 = data[seedIdx * 4]!;
  const g0 = data[seedIdx * 4 + 1]!;
  const b0 = data[seedIdx * 4 + 2]!;
  const tol = Math.max(0, Math.min(180, tolerance));

  const mask = new Uint8Array(width * height);
  const stack = [seedIdx];
  mask[seedIdx] = 1;
  let area = 1;

  while (stack.length) {
    const cur = stack.pop()!;
    const x = cur % width;
    const y = (cur / width) | 0;
    const neighbors = [cur + 1, cur - 1, cur + width, cur - width];
    for (const n of neighbors) {
      if (n < 0 || n >= mask.length) continue;
      if (mask[n]) continue;
      const nx = n % width;
      const ny = (n / width) | 0;
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      if (data[n * 4 + 3]! < 8) continue;
      if (colourDist(data, n, r0, g0, b0) > tol) continue;
      mask[n] = 1;
      area += 1;
      if (area > maxAreaPx) return null;
      stack.push(n);
    }
  }

  return { mask, areaPx: area };
}

/**
 * Grow from every painted brush pixel (hint mask), unioning regions that match
 * the local colour under that brush pixel.
 */
export function regionGrowFromBrushHint(
  imageData: ImageData,
  hintMask: Uint8Array,
  tolerance: number,
  maxAreaPx: number,
): { mask: Uint8Array; areaPx: number } | null {
  const { width, height, data } = imageData;
  if (hintMask.length !== width * height) return null;

  const seeds: number[] = [];
  for (let i = 0; i < hintMask.length; i++) {
    if (hintMask[i]) seeds.push(i);
  }
  if (!seeds.length) return null;

  let sx = 0;
  let sy = 0;
  for (const idx of seeds) {
    sx += idx % width;
    sy += (idx / width) | 0;
  }
  sx = Math.round(sx / seeds.length);
  sy = Math.round(sy / seeds.length);

  const grown = dilateMask(hintMask, width, height, 2);
  const tol = Math.max(0, Math.min(180, tolerance));
  const seedIdx = Math.max(0, Math.min(grown.length - 1, sy * width + sx));
  const r0 = data[seedIdx * 4]!;
  const g0 = data[seedIdx * 4 + 1]!;
  const b0 = data[seedIdx * 4 + 2]!;

  const mask = new Uint8Array(width * height);
  let area = 0;
  for (let i = 0; i < grown.length; i++) {
    if (!grown[i]) continue;
    if (data[i * 4 + 3]! < 8) continue;
    if (colourDist(data, i, r0, g0, b0) > tol * 1.35) continue;
    mask[i] = 1;
    area += 1;
    if (area > maxAreaPx) return null;
  }

  const filled = fillMaskHoles(mask, width, height);
  const filledArea = maskArea(filled);
  if (filledArea > maxAreaPx) return null;
  return { mask: filled, areaPx: filledArea };
}

export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return mask.slice();
  const out = mask.slice();
  const r = Math.min(12, Math.max(1, radius | 0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

export function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius <= 0) return mask.slice();
  const out = new Uint8Array(mask.length);
  const r = Math.min(12, Math.max(1, radius | 0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      let keep = true;
      for (let dy = -r; dy <= r && keep; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}

/** Expand (+) or shrink (−) selection. */
export function applyExpand(
  mask: Uint8Array,
  width: number,
  height: number,
  expandPx: number,
): Uint8Array {
  const e = Math.max(-8, Math.min(8, Math.round(expandPx)));
  if (e > 0) return dilateMask(mask, width, height, e);
  if (e < 0) return erodeMask(mask, width, height, -e);
  return mask.slice();
}

/** Apply feather as dilate (positive) or erode (negative). */
export function applyFeather(
  mask: Uint8Array,
  width: number,
  height: number,
  featherPx: number,
): Uint8Array {
  const f = Math.max(-8, Math.min(8, Math.round(featherPx)));
  if (f > 0) return dilateMask(mask, width, height, f);
  if (f < 0) return erodeMask(mask, width, height, -f);
  return mask.slice();
}

/** Fill enclosed background pockets inside the mask (simple exterior flood). */
export function fillMaskHoles(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const exterior = new Uint8Array(mask.length);
  const stack: number[] = [];
  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (exterior[idx] || mask[idx]) return;
    exterior[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }
  while (stack.length) {
    const cur = stack.pop()!;
    const x = cur % width;
    const y = (cur / width) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
  const out = mask.slice();
  for (let i = 0; i < out.length; i++) {
    if (!exterior[i] && !mask[i]) out[i] = 1;
  }
  return out;
}

function contourToAnchors(
  contour: ContourPoint[],
  width: number,
  height: number,
  smoothPasses: number,
): PathAnchor[] {
  const processed = processSilhouetteContour(contour, width, height, {
    maxDim: Math.max(width, height),
    smoothPasses: Math.max(0, Math.min(3, Math.round(smoothPasses))),
    minSpacing: Math.max(1.5, Math.max(width, height) * 0.002),
    targetPoints: 28,
  });
  const pts = processed.points.length >= 3 ? processed.points : contour;
  return migrateAnchors(
    pts.map((p) => ({
      x: p.x / Math.max(1, width - 1),
      y: p.y / Math.max(1, height - 1),
      curved: false,
      handleIn: null,
      handleOut: null,
    })),
  );
}

/** Refine core mask → display mask + polygon islands. */
export function finalizeSmartMask(
  coreMask: Uint8Array,
  width: number,
  height: number,
  params: SmartCutoutParams,
  seeds: SmartCutoutSeed[],
): SmartCutoutDetectResult {
  const minArea = params.minAreaPx ?? 12;
  const maxArea = Math.max(
    64,
    Math.floor(width * height * (params.maxAreaFraction ?? 0.08) * Math.max(1, seeds.length)),
  );

  let mask = applyExpand(
    coreMask,
    width,
    height,
    // Single border pass: expand − shrink + legacy feather (same net as old two-step).
    netExpandPx(params) + Math.round(params.feather),
  );
  mask = fillMaskHoles(mask, width, height);

  const areaPx = maskArea(mask);
  if (areaPx < minArea) {
    return { ok: false, reason: "Detected region is too small — expand selection or raise tolerance." };
  }
  if (areaPx > maxArea) {
    return {
      ok: false,
      reason: "Selection is too large — shrink, lower tolerance, or Remove Area.",
    };
  }

  const components = labelMaskComponents(mask, width, height).sort((a, b) => b.size - a.size);
  if (!components.length) {
    return { ok: false, reason: "No connected regions in the selection." };
  }

  const labels = buildComponentLabels(mask, width, height);
  const rings: PathAnchor[][] = [];
  let primaryContour: ContourPoint[] = [];

  for (const comp of components) {
    if (comp.size < minArea) continue;
    const bitmap = componentBitmap(mask, labels, width, height, comp.id);
    const contour = traceOuterContour(bitmap, width, height);
    if (contour.length < 8) continue;
    const anchors = contourToAnchors(contour, width, height, params.smoothEdge);
    if (anchors.length < 3) continue;
    if (!rings.length) primaryContour = contour;
    rings.push(anchors);
  }

  if (!rings.length) {
    return { ok: false, reason: "Could not trace a clean boundary." };
  }

  const primarySeed = seeds[0] ?? {
    x: components[0]!.centroidX,
    y: components[0]!.centroidY,
  };

  return {
    ok: true,
    mask,
    coreMask: coreMask.slice(),
    width,
    height,
    areaPx,
    contourPx: primaryContour,
    points: rings[0]!,
    regions: rings.slice(1),
    seeds: seeds.length ? seeds : [primarySeed],
    params: { ...params },
  };
}

/** Extract the connected component of `mask` that contains (x,y). */
export function extractComponentAtPoint(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): Uint8Array | null {
  const sx = Math.round(x);
  const sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  const start = sy * width + sx;
  if (!mask[start]) return null;

  const out = new Uint8Array(mask.length);
  const stack = [start];
  out[start] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % width;
    const cy = (cur / width) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!mask[ni] || out[ni]) continue;
      out[ni] = 1;
      stack.push(ni);
    }
  }
  return out;
}

function maxAreaFor(imageData: ImageData, params: SmartCutoutParams, seedCount: number): number {
  return Math.max(
    64,
    Math.floor(
      imageData.width *
        imageData.height *
        (params.maxAreaFraction ?? 0.08) *
        Math.max(1, seedCount),
    ),
  );
}

/** Detect a single region at a point (core mask only — no expand/feather). */
export function detectCoreRegionAt(
  imageData: ImageData,
  seed: SmartCutoutSeed,
  params: Pick<SmartCutoutParams, "tolerance" | "maxAreaFraction" | "minAreaPx">,
  seedCount = 1,
): { mask: Uint8Array; areaPx: number } | null {
  return regionGrowFromSeed(
    imageData,
    seed.x,
    seed.y,
    params.tolerance,
    maxAreaFor(imageData, { ...DEFAULT_SMART_CUTOUT_PARAMS, ...params }, seedCount),
  );
}

/**
 * Rebuild core mask by re-growing every seed (tolerance change).
 */
export function rebuildCoreFromSeeds(
  imageData: ImageData,
  seeds: SmartCutoutSeed[],
  params: SmartCutoutParams,
): { mask: Uint8Array; seeds: SmartCutoutSeed[] } | null {
  if (!seeds.length) return null;
  const maxArea = maxAreaFor(imageData, params, seeds.length);
  let mask: Uint8Array | null = null;
  const kept: SmartCutoutSeed[] = [];
  for (const seed of seeds) {
    const grown = regionGrowFromSeed(imageData, seed.x, seed.y, params.tolerance, maxArea);
    if (!grown) continue;
    mask = mask ? unionMasks(mask, grown.mask) : grown.mask;
    kept.push(seed);
  }
  if (!mask || !kept.length) return null;
  return { mask, seeds: kept };
}

/**
 * Detect a smart cutout from a click seed (or brush hint mask).
 */
export function detectSmartCutout(input: {
  imageData: ImageData;
  seed?: SmartCutoutSeed;
  brushHint?: Uint8Array | null;
  /** Existing core mask to merge into (Add Area). */
  existingCore?: Uint8Array | null;
  existingSeeds?: SmartCutoutSeed[];
  params?: Partial<SmartCutoutParams>;
}): SmartCutoutDetectResult {
  const { imageData } = input;
  const { width, height } = imageData;
  const params: SmartCutoutParams = {
    ...DEFAULT_SMART_CUTOUT_PARAMS,
    ...input.params,
  };
  const existingSeeds = input.existingSeeds ?? [];
  const maxArea = maxAreaFor(imageData, params, existingSeeds.length + 1);

  let grown: { mask: Uint8Array; areaPx: number } | null = null;
  let seed: SmartCutoutSeed = { x: 0, y: 0 };

  if (input.brushHint && input.brushHint.some((v) => v)) {
    grown = regionGrowFromBrushHint(imageData, input.brushHint, params.tolerance, maxArea);
    if (grown) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < grown.mask.length; i++) {
        if (!grown.mask[i]) continue;
        sx += i % width;
        sy += (i / width) | 0;
        n += 1;
      }
      seed = { x: sx / Math.max(1, n), y: sy / Math.max(1, n) };
    }
  } else if (input.seed) {
    seed = input.seed;
    grown = regionGrowFromSeed(imageData, seed.x, seed.y, params.tolerance, maxArea);
  }

  if (!grown) {
    return {
      ok: false,
      reason: "Could not detect a region — try a higher tolerance or brush the detail.",
    };
  }

  let coreMask = grown.mask;
  let seeds = [...existingSeeds, seed];
  if (input.existingCore && input.existingCore.length === coreMask.length) {
    coreMask = unionMasks(input.existingCore, grown.mask);
  }

  return finalizeSmartMask(coreMask, width, height, params, seeds);
}

/** Remove the connected component under the click from the active cutout. */
export function removeAreaAtPoint(input: {
  coreMask: Uint8Array;
  width: number;
  height: number;
  x: number;
  y: number;
  seeds: SmartCutoutSeed[];
  params: SmartCutoutParams;
}): SmartCutoutDetectResult {
  const { coreMask, width, height, x, y, seeds, params } = input;
  const component = extractComponentAtPoint(coreMask, width, height, x, y);
  if (!component) {
    return { ok: false, reason: "Click inside a selected region to remove it." };
  }
  const nextCore = subtractMasks(coreMask, component);
  if (maskArea(nextCore) < (params.minAreaPx ?? 12)) {
    return { ok: false, reason: "That would clear the entire cutout." };
  }
  const nextSeeds = seeds.filter((s) => {
    const ix = Math.round(s.x);
    const iy = Math.round(s.y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return true;
    return !component[iy * width + ix];
  });
  return finalizeSmartMask(
    nextCore,
    width,
    height,
    params,
    nextSeeds.length ? nextSeeds : [{ x, y }],
  );
}

/** Rasterize normalized polygon anchors into a binary mask (for hybrid Smart ↔ Manual). */
export function rasterizeAnchorsToMask(
  points: PathAnchor[],
  width: number,
  height: number,
  extraRegions: PathAnchor[][] = [],
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const mask = new Uint8Array(width * height);
  if (!ctx) return mask;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  const rings = [points, ...extraRegions];
  for (const ring of rings) {
    const pts = migrateAnchors(ring);
    if (pts.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x * (width - 1), pts[0]!.y * (height - 1));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x * (width - 1), pts[i]!.y * (height - 1));
    }
    ctx.closePath();
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4]! > 128 ? 1 : 0;
  }
  return mask;
}

export type SmartCutoutMeta = {
  source: "smart";
  /** Per-cutout detection settings (canonical). */
  tolerance: number;
  expand: number;
  shrink: number;
  feather: number;
  smoothEdge: number;
  /** @deprecated migrated into expand/shrink */
  expandPx?: number;
  /** @deprecated use feather */
  featherPx?: number;
  /** @deprecated use smoothEdge */
  smoothPasses?: number;
  /** @deprecated use seedsNorm — kept for backward compat */
  seedNorm?: { x: number; y: number };
  seedsNorm: { x: number; y: number }[];
  /** Extra disconnected islands (primary lives in polygon.points). */
  regions?: Array<{ x: number; y: number }[]>;
};

function settingsFromLegacyMeta(parsed: SmartCutoutMeta): CutoutDetectSettings {
  let expand = typeof parsed.expand === "number" ? parsed.expand : 0;
  let shrink = typeof parsed.shrink === "number" ? parsed.shrink : 0;
  if (typeof parsed.expandPx === "number" && parsed.expand == null && parsed.shrink == null) {
    if (parsed.expandPx >= 0) expand = parsed.expandPx;
    else shrink = -parsed.expandPx;
  }
  const feather =
    typeof parsed.feather === "number"
      ? parsed.feather
      : typeof parsed.featherPx === "number"
        ? parsed.featherPx
        : DEFAULT_CUTOUT_DETECT_SETTINGS.feather;
  const smoothEdge =
    typeof parsed.smoothEdge === "number"
      ? parsed.smoothEdge
      : typeof parsed.smoothPasses === "number"
        ? parsed.smoothPasses
        : DEFAULT_CUTOUT_DETECT_SETTINGS.smoothEdge;
  return clampCutoutDetectSettings({
    tolerance: parsed.tolerance,
    expand,
    shrink,
    feather,
    smoothEdge,
  });
}

function metaFromResult(result: SmartCutoutResult): SmartCutoutMeta {
  const seedsNorm = result.seeds.map((s) => ({
    x: s.x / Math.max(1, result.width - 1),
    y: s.y / Math.max(1, result.height - 1),
  }));
  const settings = clampCutoutDetectSettings(result.params);
  return {
    source: "smart",
    ...settings,
    seedNorm: seedsNorm[0],
    seedsNorm,
    regions: result.regions.map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))),
  };
}

/** Read this cutout's detection settings (defaults if none stored yet). */
export function getCutoutDetectSettings(
  polygon: LensPolygon | null | undefined,
): CutoutDetectSettings {
  const meta = parseSmartCutoutNotes(polygon?.notes).meta;
  if (!meta) return { ...DEFAULT_CUTOUT_DETECT_SETTINGS };
  return settingsFromLegacyMeta(meta);
}

/**
 * Write detection settings onto this cutout only (preserves seeds/regions/user notes).
 * Does not touch any other cutout.
 */
export function patchCutoutDetectSettings(
  polygon: LensPolygon,
  partial: Partial<CutoutDetectSettings>,
): LensPolygon {
  const parsed = parseSmartCutoutNotes(polygon.notes);
  const current = parsed.meta
    ? settingsFromLegacyMeta(parsed.meta)
    : { ...DEFAULT_CUTOUT_DETECT_SETTINGS };
  const nextSettings = clampCutoutDetectSettings({ ...current, ...partial });
  const seedsNorm =
    parsed.meta?.seedsNorm?.length
      ? parsed.meta.seedsNorm
      : parsed.meta?.seedNorm
        ? [parsed.meta.seedNorm]
        : [];
  const meta: SmartCutoutMeta = {
    source: "smart",
    ...nextSettings,
    seedNorm: seedsNorm[0],
    seedsNorm,
    regions: parsed.meta?.regions ?? [],
  };
  return {
    ...polygon,
    notes: encodeSmartCutoutNotes(parsed.userNotes, meta),
  };
}

/** Build a Manual Detail (frame exclusion) from a successful detection. */
export function createSmartCutoutFramePart(
  result: SmartCutoutResult,
  label: string,
  extras?: Partial<Pick<LensPolygon, "layerOrder" | "opacity" | "depth" | "visible">>,
): LensPolygon {
  const id = `smart-cutout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const baseline = migrateAnchors(result.points);
  const smartCutout = metaFromResult(result);
  const part = createLensPolygon(id, label, result.points, {
    layerOrder: extras?.layerOrder ?? "front",
    opacity: extras?.opacity ?? 100,
    depth: extras?.depth ?? 50,
    visible: extras?.visible !== false,
    holes: [],
    shapePreset: "free",
    shapeBaseline: baseline,
    notes: encodeSmartCutoutNotes("", smartCutout),
  });
  return part;
}

/** Build a hole cutout from detection (for Manual Detail holes). */
export function createSmartCutoutHole(result: SmartCutoutResult, label: string): LensPolygon {
  const id = `smart-hole-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const baseline = migrateAnchors(result.points);
  const smartCutout = metaFromResult(result);
  return createLensPolygon(id, label, result.points, {
    shapePreset: "free",
    shapeBaseline: baseline,
    notes: encodeSmartCutoutNotes("", smartCutout),
  });
}

/** Update an existing polygon's geometry + smart meta from a detection result. */
export function applySmartResultToPolygon(
  polygon: LensPolygon,
  result: SmartCutoutResult,
): LensPolygon {
  const parsed = parseSmartCutoutNotes(polygon.notes);
  const smartCutout = metaFromResult(result);
  return {
    ...polygon,
    points: result.points,
    shapePreset: "free",
    shapeBaseline: migrateAnchors(result.points),
    notes: encodeSmartCutoutNotes(parsed.userNotes, smartCutout),
  };
}

const SMART_NOTES_PREFIX = "__smartCutout__:";

export function encodeSmartCutoutNotes(userNotes: string, meta: SmartCutoutMeta): string {
  return `${SMART_NOTES_PREFIX}${JSON.stringify(meta)}${userNotes ? `\n${userNotes}` : ""}`;
}

export function parseSmartCutoutNotes(
  notes: string | null | undefined,
): { meta: SmartCutoutMeta | null; userNotes: string } {
  if (!notes || typeof notes !== "string") return { meta: null, userNotes: "" };
  if (!notes.startsWith(SMART_NOTES_PREFIX)) return { meta: null, userNotes: notes };
  const rest = notes.slice(SMART_NOTES_PREFIX.length);
  const nl = rest.indexOf("\n");
  const json = nl >= 0 ? rest.slice(0, nl) : rest;
  const userNotes = nl >= 0 ? rest.slice(nl + 1) : "";
  try {
    const parsed = JSON.parse(json) as SmartCutoutMeta;
    if (parsed?.source !== "smart") return { meta: null, userNotes: notes };
    const seedsNorm =
      Array.isArray(parsed.seedsNorm) && parsed.seedsNorm.length
        ? parsed.seedsNorm
        : parsed.seedNorm
          ? [parsed.seedNorm]
          : [];
    return {
      meta: {
        source: "smart",
        ...settingsFromLegacyMeta(parsed),
        seedNorm: seedsNorm[0],
        seedsNorm,
        regions: Array.isArray(parsed.regions) ? parsed.regions : [],
      },
      userNotes,
    };
  } catch {
    return { meta: null, userNotes: notes };
  }
}

/** Extra island rings stored in smart meta (for multipath clip rendering). */
export function smartCutoutExtraRings(polygon: LensPolygon | null | undefined): PathAnchor[][] {
  const meta = parseSmartCutoutNotes(polygon?.notes).meta;
  if (!meta?.regions?.length) return [];
  return meta.regions
    .map((ring) => migrateAnchors(ring.map((p) => ({ x: p.x, y: p.y }))))
    .filter((ring) => ring.length >= 3);
}

/** Load ImageData from a plate URL (editor only). */
export async function loadImageDataFromUrl(url: string): Promise<ImageData | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w <= 0 || h <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}
