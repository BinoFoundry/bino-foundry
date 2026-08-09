/**
 * Continuous mm → px mapping for bracelet strand rendering.
 *
 * Wrist fit, capacity, and pricing always use true database mm values.
 * Base physical footprint is linear in catalogue mm.
 * Optional {@link calibratedVisualDiameterPx} exponent compresses visual size jumps
 * without changing occupancy — applied on the visual shell path only.
 */

import {
  STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM,
  STRAND_VISUAL_SIZE_SCALING_MAX,
  STRAND_VISUAL_SIZE_SCALING_MIN,
} from "@bino-foundry/shared/types";

/** Soft ceiling for very large catalog sizes (px at scale factor 1). */
export const VISUAL_BEAD_MAX_PX = 55;

/**
 * Pixels per millimetre at layout scale factor 1 (linear base).
 * Anchored so 6 mm keeps its calibrated feel under any size-curve exponent.
 */
export const VISUAL_PX_PER_MM = 3.375;

/** @deprecated Kept for tests/migration notes — no longer added to diameters. */
export const VISUAL_BEAD_BASE_PX = 0;

/** Reference size (mm) whose visual diameter is invariant under the size curve. */
export const VISUAL_SIZE_CURVE_ANCHOR_MM = STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM;

/**
 * @deprecated Prefer reading `visualSizeScaling` from the resolved strand profile.
 * Linear default when no profile is available.
 */
export const VISUAL_SIZE_CURVE_EXPONENT = 1;

export function clampVisualSizeScaling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(STRAND_VISUAL_SIZE_SCALING_MIN, Math.min(STRAND_VISUAL_SIZE_SCALING_MAX, value));
}

/**
 * Map physical bead diameter (mm) to visual pixel diameter.
 *
 * `visualSizeScaling = 1` → linear: px = VISUAL_PX_PER_MM × mm.
 * Otherwise: px = VISUAL_PX_PER_MM × anchor × (mm / anchor)^exponent
 * so the anchor size (6 mm) is unchanged for any exponent.
 */
export function calibratedVisualDiameterPx(
  sizeMm: number,
  visualSizeScaling: number = VISUAL_SIZE_CURVE_EXPONENT,
): number {
  const mm = sizeMm > 0 ? sizeMm : 0.01;
  const exponent = clampVisualSizeScaling(visualSizeScaling);
  const anchor = VISUAL_SIZE_CURVE_ANCHOR_MM;
  const px = VISUAL_PX_PER_MM * anchor * Math.pow(mm / anchor, exponent);
  return Math.min(VISUAL_BEAD_MAX_PX, px);
}

/**
 * Factor to multiply a linear mm→px diameter so it matches the size curve.
 * At the anchor mm (or exponent 1) this is always 1.
 */
export function visualSizeCurveRelativeFactor(
  sizeMm: number,
  visualSizeScaling: number = VISUAL_SIZE_CURVE_EXPONENT,
): number {
  const linear = calibratedVisualDiameterPx(sizeMm, 1);
  if (linear <= 0) return 1;
  return calibratedVisualDiameterPx(sizeMm, visualSizeScaling) / linear;
}

/**
 * Ratio of visual diameters for two configured mm values (layout-scale independent).
 * Used when scaling a canonical asset diameter across sizes.
 */
export function visualDiameterRatio(
  configuredMm: number,
  referenceMm: number,
  visualSizeScaling: number = VISUAL_SIZE_CURVE_EXPONENT,
): number {
  const ref = referenceMm > 0 ? referenceMm : VISUAL_SIZE_CURVE_ANCHOR_MM;
  return (
    calibratedVisualDiameterPx(configuredMm, visualSizeScaling) /
    calibratedVisualDiameterPx(ref, visualSizeScaling)
  );
}
