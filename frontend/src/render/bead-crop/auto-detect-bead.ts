import { normalizeBeadAnchor, type BeadPathAnchor } from "@bino-foundry/shared/types";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";

export interface DetectBeadOutlineOptions {
  /** Pixels at or above this luminance (with low sat) are treated as background. */
  bgLumMin?: number;
  satMax?: number;
  /** Alpha values at or below this are transparent background (PNG). */
  alphaBgMax?: number;
  closeRadius?: number;
  openRadius?: number;
  /** Approximate vertex count after simplification. */
  targetPoints?: number;
  /** Minimum foreground area as a fraction of image (reject empty detections). */
  minForegroundRatio?: number;
}

export interface DetectBeadOutlineResult {
  points: BeadPathAnchor[];
  confidence: number;
}

const DEFAULTS: Required<DetectBeadOutlineOptions> = {
  bgLumMin: 240,
  satMax: 42,
  alphaBgMax: 16,
  closeRadius: 3,
  openRadius: 2,
  targetPoints: 20,
  minForegroundRatio: 0.006,
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
  const dilated = dilate(mask, width, height, 4);

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

/** Moore-neighbor outer contour trace (clockwise). */
function traceOuterContour(mask: Uint8Array, width: number, height: number): { x: number; y: number }[] {
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height && startX < 0; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        startX = x;
        startY = y;
        break;
      }
    }
  }
  if (startX < 0) return [];

  const path: { x: number; y: number }[] = [];
  let x = startX;
  let y = startY;
  let dir = 0;
  const maxSteps = width * height * 4;
  let steps = 0;

  do {
    path.push({ x, y });
    let found = false;
    const startDir = (dir + 5) % 8;
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = x + NEIGHBORS[d].dx;
      const ny = y + NEIGHBORS[d].dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!mask[ny * width + nx]) continue;
      x = nx;
      y = ny;
      dir = d;
      found = true;
      break;
    }
    if (!found) break;
    steps++;
  } while ((x !== startX || y !== startY || path.length < 3) && steps < maxSteps);

  return path;
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function simplifyRdp(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRdp(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyRdp(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

function simplifyToTargetCount(
  points: { x: number; y: number }[],
  target: number,
  maxDim: number,
): { x: number; y: number }[] {
  if (points.length <= target) return points;
  let lo = 0;
  let hi = maxDim * 0.45;
  let best = points;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const simplified = simplifyRdp(points, mid);
    if (simplified.length > target) lo = mid;
    else {
      hi = mid;
      best = simplified;
    }
  }
  return best.length >= 3 ? best : points.slice(0, Math.max(3, target));
}

function decimateContour(
  points: { x: number; y: number }[],
  minSpacing: number,
): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minSpacing) out.push(p);
  }
  return out.length >= 3 ? out : points;
}

function maskToPathAnchors(
  mask: Uint8Array,
  width: number,
  height: number,
  opts: Required<DetectBeadOutlineOptions>,
): BeadPathAnchor[] {
  const contour = traceOuterContour(mask, width, height);
  if (contour.length < 3) return [];

  const minSpacing = Math.max(1.5, Math.min(width, height) * 0.008);
  const decimated = decimateContour(contour, minSpacing);
  const simplified = simplifyToTargetCount(decimated, opts.targetPoints, Math.max(width, height));

  return simplified.map((p) =>
    normalizeBeadAnchor({
      x: p.x / width,
      y: p.y / height,
      curved: false,
      handleIn: null,
      handleOut: null,
    }),
  );
}

function computeConfidence(
  foregroundPixels: number,
  width: number,
  height: number,
  pointCount: number,
): number {
  const ratio = foregroundPixels / (width * height);
  if (ratio < 0.004 || ratio > 0.88) return 0.15;
  let confidence = 0.55;
  if (ratio >= 0.015 && ratio <= 0.7) confidence += 0.2;
  if (pointCount >= 8) confidence += 0.15;
  if (pointCount >= 12) confidence += 0.1;
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
  mask = morphCloseOpen(mask, width, height, 1, 1);

  let foregroundPixels = countMaskPixels(mask);
  const minPixels = width * height * opts.minForegroundRatio;

  if (foregroundPixels < minPixels) {
    const relaxed = { ...opts, bgLumMin: opts.bgLumMin - 12, satMax: opts.satMax + 18 };
    mask = buildForegroundMask(data, width, height, relaxed);
    mask = morphCloseOpen(mask, width, height, opts.closeRadius, opts.openRadius);
    mask = keepLargestComponent(mask, width, height);
    mask = recoverSpecularHighlights(mask, data, width, height, relaxed);
    foregroundPixels = countMaskPixels(mask);
  }

  if (foregroundPixels < minPixels) {
    return { points: [], confidence: 0 };
  }

  const points = maskToPathAnchors(mask, width, height, opts);
  const confidence = computeConfidence(foregroundPixels, width, height, points.length);
  return { points, confidence };
}

/**
 * Detect a single bead outline on a plain/light background (no AI).
 * Returns normalized path anchors ready for the crop editor.
 */
export function detectBeadOutline(
  source: HTMLImageElement | HTMLCanvasElement,
  userOpts: DetectBeadOutlineOptions = {},
): DetectBeadOutlineResult {
  const { data, width, height } = getImageDataFromSource(source);
  return detectBeadOutlineFromRgba(data, width, height, userOpts);
}
