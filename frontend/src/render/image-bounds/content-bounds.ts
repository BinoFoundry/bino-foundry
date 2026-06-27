/** Tight bounding box of visible image content (transparent or light background trimmed). */

export interface ImageContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectContentBoundsOptions {
  /** Pixels at or below this alpha are treated as empty (PNG/WebP). */
  alphaMax?: number;
  /** When few transparent pixels, treat bright low-saturation pixels as background. */
  bgLumMin?: number;
  bgSatMax?: number;
  /** Extra padding around detected bounds (px). */
  paddingPx?: number;
}

const DEFAULTS: Required<DetectContentBoundsOptions> = {
  alphaMax: 12,
  bgLumMin: 248,
  bgSatMax: 18,
  paddingPx: 2,
};

/** Sunglasses plate preview — trim warm studio grays (#DED6D2, off-white) around frames. */
export const PLATE_PREVIEW_BOUNDS_OPTS: DetectContentBoundsOptions = {
  alphaMax: 12,
  bgLumMin: 200,
  bgSatMax: 42,
  paddingPx: 4,
};

function lum(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function sat(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isForeground(
  r: number,
  g: number,
  b: number,
  a: number,
  useAlpha: boolean,
  opts: Required<DetectContentBoundsOptions>,
): boolean {
  if (useAlpha) return a > opts.alphaMax;
  return !(lum(r, g, b) >= opts.bgLumMin && sat(r, g, b) <= opts.bgSatMax);
}

/**
 * Scan RGBA image data and return the tight bounds of non-empty pixels.
 * Shared by bead crop export and sunglasses plate normalization.
 */
export function detectContentBoundsFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: DetectContentBoundsOptions,
): ImageContentBounds | null {
  const opts = { ...DEFAULTS, ...options };
  if (width <= 0 || height <= 0) return null;

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! <= opts.alphaMax) transparent++;
  }
  const useAlpha = transparent > (width * height * 0.008);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (!isForeground(r, g, b, a, useAlpha, opts)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const pad = opts.paddingPx;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);

  return {
    x,
    y,
    width: Math.max(1, right - x + 1),
    height: Math.max(1, bottom - y + 1),
  };
}

export function contentBoundsViewBox(
  bounds: ImageContentBounds,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const x = Math.max(0, Math.min(bounds.x, sourceWidth - 1));
  const y = Math.max(0, Math.min(bounds.y, sourceHeight - 1));
  const w = Math.max(1, Math.min(bounds.width, sourceWidth - x));
  const h = Math.max(1, Math.min(bounds.height, sourceHeight - y));
  return `${x} ${y} ${w} ${h}`;
}

export function fullPlateViewBox(width: number, height: number): string {
  return `0 0 ${width} ${height}`;
}
