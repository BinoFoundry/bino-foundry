/**
 * Continuous mm → px mapping for bracelet strand rendering.
 *
 * Wrist fit, capacity, and pricing always use true database mm values.
 * Visual footprint is strictly proportional to catalogue mm — no fixed pixel offset.
 */

/** Soft ceiling for very large catalog sizes (px at scale factor 1). */
export const VISUAL_BEAD_MAX_PX = 55;

/**
 * Pixels per millimetre at layout scale factor 1.
 * Anchored so 8 mm ≈ 27 px before site calibration (matches prior 8 mm feel without +2 px bias).
 */
export const VISUAL_PX_PER_MM = 3.375;

/** @deprecated Kept for tests/migration notes — no longer added to diameters. */
export const VISUAL_BEAD_BASE_PX = 0;

/** Reference size (mm) for ratio helpers. */
export const VISUAL_SIZE_CURVE_ANCHOR_MM = 8;

/**
 * @deprecated Linear mapping no longer uses a power curve. Kept for import compatibility.
 */
export const VISUAL_SIZE_CURVE_EXPONENT = 1;

/**
 * Map physical bead diameter (mm) to visual pixel diameter.
 * Proportional: px = VISUAL_PX_PER_MM × mm (capped at MAX).
 */
export function calibratedVisualDiameterPx(sizeMm: number): number {
  const mm = sizeMm > 0 ? sizeMm : 0.01;
  return Math.min(VISUAL_BEAD_MAX_PX, VISUAL_PX_PER_MM * mm);
}

/**
 * Ratio of visual diameters for two configured mm values (layout-scale independent).
 * Used when scaling a canonical asset diameter across sizes.
 */
export function visualDiameterRatio(configuredMm: number, referenceMm: number): number {
  const ref = referenceMm > 0 ? referenceMm : VISUAL_SIZE_CURVE_ANCHOR_MM;
  return calibratedVisualDiameterPx(configuredMm) / calibratedVisualDiameterPx(ref);
}
