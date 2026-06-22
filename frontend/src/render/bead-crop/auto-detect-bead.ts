import { type BeadPathAnchor } from "@bino-foundry/shared/types";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";
import {
  processSilhouetteContour,
  traceOuterContour,
  type ContourPoint,
} from "@/render/mask/mask-contour";

import { contourToBeadPathAnchors } from "./contour-to-bead-path";

export interface DetectBeadOutlineOptions {
  /** Pixels at or above this luminance (with low sat) are treated as background. */
  bgLumMin?: number;
  satMax?: number;
  /** Alpha values at or below this are transparent background (PNG). */
  alphaBgMax?: number;
  /** Morphological close radius — keep low to preserve concave detail. */
  closeRadius?: number;
  openRadius?: number;
  /** Approximate vertex count after simplification (0 = adaptive). */
  targetPoints?: number;
  /** Minimum foreground area as a fraction of image (reject empty detections). */
  minForegroundRatio?: number;
  /** Chaikin smoothing passes applied after contour extraction. */
  smoothPasses?: number;
}

export interface BeadOutlineDetectionMeta {
  contourPointCount: number;
  pathPointCount: number;
  curvedSegmentCount: number;
  autoDetected: true;
}

export interface DetectBeadOutlineResult {
  points: BeadPathAnchor[];
  confidence: number;
  detection?: BeadOutlineDetectionMeta;
}

const DEFAULTS: Required<DetectBeadOutlineOptions> = {
  bgLumMin: 240,
  satMax: 42,
  alphaBgMax: 16,
  closeRadius: 1,
  openRadius: 1,
  targetPoints: 0,
  minForegroundRatio: 0.006,
  smoothPasses: 2,
};

const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
] as const;

function lum(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function sat(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function getImageDataFromSource(source: HTMLImageElement | HTMLCanvasElement) {
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

function countTransparentPixels(data: Uint8ClampedArray): number {
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= DEFAULTS.alphaBgMax) transparent++;
  }
  return transparent;
}

function buildForegroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: Required<DetectBeadOutlineOptions>,
): Uint8Array {
  const n = width * height;
  const mask = new Uint8Array(n);
  const transparentCount = countTransparentPixels(data);
  const useAlpha = transparentCount > n * 0.01;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (useAlpha) {
        if (a > opts.alphaBgMax) mask[y * width + x] = 1;
        continue;
      }

      const l = lum(r, g, b);
      const s = sat(r, g, b);
      if (l >= opts.bgLumMin && s <= opts.satMax) continue;
      mask[y * width + x] = 1;
    }
  }

  return mask;
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius < 1) return mask.slice();
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
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

function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius < 1) return mask.slice();
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
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

function morphCloseOpen(
  mask: Uint8Array,
  width: number,
  height: number,
  closeR: number,
  openR: number,
): Uint8Array {
  let m = mask;
  if (closeR > 0) m = erode(dilate(m, width, height, closeR), width, height, closeR);
  if (openR > 0) m = dilate(erode(m, width, height, openR), width, height, openR);
  return m;
}

function keepLargestComponent(mask: Uint8Array, width: number, height: number): Uint8Array {
  const labels = new Int32Array(mask.length);
  const sizes: { id: number; size: number }[] = [];
  let next = 1;

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx] || labels[idx]) continue;
    const stack = [idx];
    labels[idx] = next;
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      const x = cur % width;
      const y = (cur / width) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || labels[ni]) continue;
        labels[ni] = next;
        stack.push(ni);
      }
    }
    sizes.push({ id: next, size });
    next++;
  }

  if (!sizes.length) return mask;

  sizes.sort((a, b) => b.size - a.size);
  const keepId = sizes[0].id;
  const out = new Uint8Array(mask.length);
  for (let idx = 0; idx < mask.length; idx++) {
    if (labels[idx] === keepId) out[idx] = 1;
  }
  return out;
}

function countMaskPixels(mask: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) c++;
  return c;
}

function recoverSpecularHighlights(
  mask: Uint8Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: Required<DetectBeadOutlineOptions>,
): Uint8Array {
  const out = mask.slice();
  const dilated = dilate(mask, width, height, 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (out[idx] || !dilated[idx]) continue;
      const i = idx * 4;
      const l = lum(data[i], data[i + 1], data[i + 2]);
      const s = sat(data[i], data[i + 1], data[i + 2]);
      if (l > 200 && l < opts.bgLumMin - 6 && s < opts.satMax + 20) {
        out[idx] = 1;
      }
    }
  }
  return out;
}

/** Refine mask boundary using local color contrast (helps irregular / textured edges). */
function refineMaskEdges(
  mask: Uint8Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const out = mask.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;

      let border = false;
      for (const n of NEIGHBORS) {
        if (!mask[(y + n.dy) * width + (x + n.dx)]) {
          border = true;
          break;
        }
      }
      if (!border) continue;

      const i = idx * 4;
      const centerLum = lum(data[i], data[i + 1], data[i + 2]);
      let maxContrast = 0;
      for (const n of NEIGHBORS) {
        const ni = ((y + n.dy) * width + (x + n.dx)) * 4;
        const neighborLum = lum(data[ni], data[ni + 1], data[ni + 2]);
        maxContrast = Math.max(maxContrast, Math.abs(centerLum - neighborLum));
      }
      if (maxContrast < 8 && data[i + 3] < 200) {
        out[idx] = 0;
      }
    }
  }
  return out;
}

function maskToPathAnchors(
  mask: Uint8Array,
  width: number,
  height: number,
  opts: Required<DetectBeadOutlineOptions>,
): { points: BeadPathAnchor[]; meta: BeadOutlineDetectionMeta | undefined } {
  const contour = traceOuterContour(mask, width, height);
  if (contour.length < 3) return { points: [], meta: undefined };

  const maxDim = Math.max(width, height);
  const processed = processSilhouetteContour(contour, width, height, {
    targetPoints: opts.targetPoints > 0 ? opts.targetPoints : undefined,
    smoothPasses: opts.smoothPasses,
    maxDim,
  });

  if (processed.points.length < 3) return { points: [], meta: undefined };

  const { anchors, curvedSegmentCount } = contourToBeadPathAnchors(
    processed.points,
    width,
    height,
  );

  return {
    points: anchors,
    meta: {
      contourPointCount: processed.rawPointCount,
      pathPointCount: anchors.length,
      curvedSegmentCount,
      autoDetected: true,
    },
  };
}

function computeConfidence(
  foregroundPixels: number,
  width: number,
  height: number,
  pointCount: number,
  curvedSegments: number,
): number {
  const ratio = foregroundPixels / (width * height);
  if (ratio < 0.004 || ratio > 0.88) return 0.15;
  let confidence = 0.55;
  if (ratio >= 0.015 && ratio <= 0.7) confidence += 0.2;
  if (pointCount >= 12) confidence += 0.12;
  if (pointCount >= 20) confidence += 0.08;
  if (curvedSegments >= 4) confidence += 0.05;
  return Math.min(1, confidence);
}

/** Detect bead outline from raw RGBA buffer (used in tests). */
export function detectBeadOutlineFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  userOpts: DetectBeadOutlineOptions = {},
): DetectBeadOutlineResult {
  const opts = { ...DEFAULTS, ...userOpts };
  if (!width || !height) return { points: [], confidence: 0 };

  let mask = buildForegroundMask(data, width, height, opts);
  mask = morphCloseOpen(mask, width, height, opts.closeRadius, opts.openRadius);
  mask = keepLargestComponent(mask, width, height);
  mask = recoverSpecularHighlights(mask, data, width, height, opts);
  mask = refineMaskEdges(mask, data, width, height);
  mask = morphCloseOpen(mask, width, height, 0, 1);

  let foregroundPixels = countMaskPixels(mask);
  const minPixels = width * height * opts.minForegroundRatio;

  if (foregroundPixels < minPixels) {
    const relaxed = { ...opts, bgLumMin: opts.bgLumMin - 12, satMax: opts.satMax + 18 };
    mask = buildForegroundMask(data, width, height, relaxed);
    mask = morphCloseOpen(mask, width, height, opts.closeRadius, opts.openRadius);
    mask = keepLargestComponent(mask, width, height);
    mask = recoverSpecularHighlights(mask, data, width, height, relaxed);
    mask = refineMaskEdges(mask, data, width, height);
    foregroundPixels = countMaskPixels(mask);
  }

  if (foregroundPixels < minPixels) {
    return { points: [], confidence: 0 };
  }

  const { points, meta } = maskToPathAnchors(mask, width, height, opts);
  const confidence = computeConfidence(
    foregroundPixels,
    width,
    height,
    points.length,
    meta?.curvedSegmentCount ?? 0,
  );
  return { points, confidence, detection: meta };
}

/**
 * Detect a single bead silhouette on a plain/light background (no AI).
 * Returns normalized Bézier path anchors ready for the crop editor.
 */
export function detectBeadOutline(
  source: HTMLImageElement | HTMLCanvasElement,
  userOpts: DetectBeadOutlineOptions = {},
): DetectBeadOutlineResult {
  const { data, width, height } = getImageDataFromSource(source);
  return detectBeadOutlineFromRgba(data, width, height, userOpts);
}

/** Rasterize a binary mask for debug / preview overlays. */
export function maskToPreviewCanvas(
  mask: Uint8Array,
  width: number,
  height: number,
  color = "rgba(236, 72, 153, 0.45)",
): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const imageData = ctx.createImageData(width, height);
  const [r, g, b] = [236, 72, 153];
  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx]) continue;
    const i = idx * 4;
    imageData.data[i] = r;
    imageData.data[i + 1] = g;
    imageData.data[i + 2] = b;
    imageData.data[i + 3] = 115;
  }
  ctx.putImageData(imageData, 0, 0);
  void color;
  return canvas;
}

export function contourToPreviewPath(contour: ContourPoint[], width: number, height: number): string {
  if (contour.length < 2) return "";
  const first = contour[0]!;
  const parts = [`M ${(first.x / width) * 100}% ${(first.y / height) * 100}%`];
  for (let i = 1; i < contour.length; i++) {
    const p = contour[i]!;
    parts.push(`L ${(p.x / width) * 100}% ${(p.y / height) * 100}%`);
  }
  parts.push("Z");
  return parts.join(" ");
}
