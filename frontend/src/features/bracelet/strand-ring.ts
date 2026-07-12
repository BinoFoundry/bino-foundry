import { STRAND_RING_EDGE_PADDING_PX } from "./strand-viewport";

export interface WristSizeBounds {
  minCm: number;
  maxCm: number;
}

/** Derive min/max from active catalogue wrist sizes (database-driven). */
export function wristSizeBoundsFromCatalog(
  sizeCmValues: number[],
  fallbackCm = 0,
): WristSizeBounds {
  if (!sizeCmValues.length) {
    const v = fallbackCm > 0 ? fallbackCm : 1;
    return { minCm: v, maxCm: v };
  }
  return {
    minCm: Math.min(...sizeCmValues),
    maxCm: Math.max(...sizeCmValues),
  };
}

export const STRAND_RING_STROKE_WIDTH_FACTOR = 3.4;
export const STRAND_RING_STROKE_MIN_PX = 2;

/** Guide-ring stroke width in layout px (matches strand cord SVG). */
export function computeStrandRingStrokePx(scaleFactor: number): number {
  return Math.max(STRAND_RING_STROKE_MIN_PX, STRAND_RING_STROKE_WIDTH_FACTOR * scaleFactor);
}

/**
 * Ring radius (px) mapped linearly across the database wrist-size range.
 * Each distinct `sizeCm` produces a distinct radius — no wrist-size clamping.
 */
export function computeWristRingRadiusPx(
  centerPx: number,
  wristSizeCm: number,
  scaleFactor: number,
  maxSlotExtentPx: number,
  bounds: WristSizeBounds,
  ringStrokeHalfPx = 0,
): number {
  const padding = STRAND_RING_EDGE_PADDING_PX * scaleFactor;
  const available = Math.max(1, centerPx - padding - maxSlotExtentPx / 2 - ringStrokeHalfPx);
  const span = Math.max(bounds.maxCm - bounds.minCm, 0.01);
  const t = Math.max(0, Math.min(1, (wristSizeCm - bounds.minCm) / span));
  const minFill = 0.52;
  const maxFill = 0.98;
  const fill = minFill + t * (maxFill - minFill);
  return available * fill;
}

/** Maximum ring radius that fits on the canvas (upper bound for visual expansion). */
export function computeMaxRingRadiusPx(
  centerPx: number,
  scaleFactor: number,
  maxSlotExtentPx: number,
): number {
  const padding = STRAND_RING_EDGE_PADDING_PX * scaleFactor;
  return Math.max(1, centerPx - padding - maxSlotExtentPx / 2);
}
