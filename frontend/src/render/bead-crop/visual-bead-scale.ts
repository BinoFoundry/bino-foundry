/**
 * Continuous mm → px mapping for bracelet strand rendering.
 *
 * Wrist fit, capacity, and pricing always use true database mm values.
 * This formula only affects the visual footprint on the canvas.
 */

/** Baseline offset so sub-millimetre beads remain visible and strictly ordered. */
export const VISUAL_BEAD_BASE_PX = 2;

/** Soft ceiling for very large catalog sizes (px at scale factor 1). */
export const VISUAL_BEAD_MAX_PX = 55;

/**
 * Pixels per millimetre at layout scale factor 1 (before global render scale).
 * Calibrated so 8 mm ≈ 29 px (2 + 3.375 × 8).
 */
export const VISUAL_PX_PER_MM = 3.375;

/**
 * Map physical bead diameter (mm) to visual pixel diameter.
 * Fully continuous: px = BASE + (PX_PER_MM × mm), capped at MAX.
 */
export function calibratedVisualDiameterPx(sizeMm: number): number {
  const mm = sizeMm > 0 ? sizeMm : 0.01;
  const linear = VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * mm;
  return Math.min(VISUAL_BEAD_MAX_PX, linear);
}
