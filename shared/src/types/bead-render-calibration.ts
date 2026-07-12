/** Uniform scale applied when converting database `size_mm` to rendered diameter. */
export const BEAD_RENDER_CALIBRATION_FACTOR_MIN = 0.5;
export const BEAD_RENDER_CALIBRATION_FACTOR_MAX = 1.25;

/**
 * Default bracelet bead render calibration.
 * Applied once in layoutDiameterPxForMm — all sizes scale proportionally.
 */
export const DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR = 0.78;

export function clampBeadRenderCalibrationFactor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR;
  }
  return Math.max(
    BEAD_RENDER_CALIBRATION_FACTOR_MIN,
    Math.min(BEAD_RENDER_CALIBRATION_FACTOR_MAX, value),
  );
}
