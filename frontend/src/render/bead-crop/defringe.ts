export interface DefringeOptions {
  /** Assumed plate background (product photos default to white). */
  background?: { r: number; g: number; b: number };
  /** Only correct semi-transparent pixels at or above this min channel (0–255). */
  minChannel?: number;
  /** Max channel spread — avoids correcting genuinely coloured edge pixels. */
  maxChannelSpread?: number;
}

const DEFAULTS: Required<DefringeOptions> = {
  background: { r: 255, g: 255, b: 255 },
  minChannel: 165,
  maxChannelSpread: 56,
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function isWhiteSpillPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  opts: Required<DefringeOptions>,
): boolean {
  if (a <= 0 || a >= 255) return false;
  const minC = Math.min(r, g, b);
  const maxC = Math.max(r, g, b);
  const spread = maxC - minC;
  if (spread > opts.maxChannelSpread) return false;
  const avg = (r + g + b) / 3;
  return minC >= opts.minChannel || avg >= opts.minChannel;
}

/**
 * Remove white-background spill from semi-transparent edge pixels.
 * Recovers foreground RGB from compositing: observed = α·fg + (1−α)·bg.
 */
export function defringeImageData(
  imageData: ImageData,
  options?: DefringeOptions,
): ImageData {
  const opts = { ...DEFAULTS, ...options, background: { ...DEFAULTS.background, ...options?.background } };
  const { data } = imageData;
  const { r: bgR, g: bgG, b: bgB } = opts.background;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (!isWhiteSpillPixel(data[i]!, data[i + 1]!, data[i + 2]!, a, opts)) continue;

    const alpha = a / 255;
    const inv = 1 - alpha;
    data[i] = clampByte((data[i]! - inv * bgR) / alpha);
    data[i + 1] = clampByte((data[i + 1]! - inv * bgG) / alpha);
    data[i + 2] = clampByte((data[i + 2]! - inv * bgB) / alpha);
  }

  return imageData;
}

/** Apply defringe in-place on a canvas 2D context. */
export function defringeCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: DefringeOptions,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  defringeImageData(imageData, options);
  ctx.putImageData(imageData, 0, 0);
}
