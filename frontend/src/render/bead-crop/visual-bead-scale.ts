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
 * Pixels per millimetre at layout scale factor 1 for the linear reference curve.
 * Used to anchor the sub-linear calibration at {@link VISUAL_SIZE_CURVE_ANCHOR_MM}.
 */
export const VISUAL_PX_PER_MM = 3.375;

/** Anchor size (mm) — curve matches the legacy linear baseline here (8 mm ≈ 29 px). */
export const VISUAL_SIZE_CURVE_ANCHOR_MM = 8;

/**
 * Sub-linear exponent (< 1 compresses visual jumps as beads grow larger).
 * Fully continuous — works for any positive database mm without breakpoints.
 */
export const VISUAL_SIZE_CURVE_EXPONENT = 0.84;

function visualCurveScaleK(): number {
  const anchorPx = VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * VISUAL_SIZE_CURVE_ANCHOR_MM;
  const span = anchorPx - VISUAL_BEAD_BASE_PX;
  return span / Math.pow(VISUAL_SIZE_CURVE_ANCHOR_MM, VISUAL_SIZE_CURVE_EXPONENT);
}

/**
 * Map physical bead diameter (mm) to visual pixel diameter.
 *
 * Sub-linear power curve: px = BASE + K × mm^EXPONENT (capped at MAX).
 * Larger sizes grow more slowly than a linear mm mapping while preserving strict ordering.
 */
export function calibratedVisualDiameterPx(sizeMm: number): number {
  const mm = sizeMm > 0 ? sizeMm : 0.01;
  const curved = VISUAL_BEAD_BASE_PX + visualCurveScaleK() * Math.pow(mm, VISUAL_SIZE_CURVE_EXPONENT);
  return Math.min(VISUAL_BEAD_MAX_PX, curved);
}

/**
 * Ratio of visual diameters for two configured mm values (layout-scale independent).
 * Used when scaling a canonical asset diameter across sizes.
 */
export function visualDiameterRatio(configuredMm: number, referenceMm: number): number {
  const ref = referenceMm > 0 ? referenceMm : VISUAL_SIZE_CURVE_ANCHOR_MM;
  return calibratedVisualDiameterPx(configuredMm) / calibratedVisualDiameterPx(ref);
}
