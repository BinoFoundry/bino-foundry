/**
 * Single source of truth: configured mm → layout pixel diameter.
 *
 * Wrist fit, capacity, and pricing use database mm values.
 * Visual footprint uses this continuous mapping at runtime, scaled by
 * {@link getBeadRenderCalibrationFactor} for bracelet realism.
 */

import {
  clampBeadRenderCalibrationFactor,
  DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR,
} from "@bino-foundry/shared/types";

import { calibratedVisualDiameterPx } from "./visual-bead-scale";

/** Reference mm for the calibrated px curve (8 mm ≈ 29 px at scale 1). */
export const CANONICAL_STRAND_REFERENCE_MM = 8;

/**
 * @deprecated Use DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR or getBeadRenderCalibrationFactor().
 */
export const GLOBAL_BEAD_RENDER_SCALE = DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR;

let beadRenderCalibrationFactor = DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR;

/** Runtime calibration from site settings — set once when settings/catalogue load. */
export function setBeadRenderCalibrationFactor(factor: number): void {
  beadRenderCalibrationFactor = clampBeadRenderCalibrationFactor(factor);
}

export function getBeadRenderCalibrationFactor(): number {
  return beadRenderCalibrationFactor;
}

/**
 * Layout pixel diameter for a configured bead size.
 * renderDiameterPx = calibratedCurve(configuredMm) × layoutScale × calibrationFactor
 */
export function layoutDiameterPxForMm(configuredMm: number, layoutScale: number): number {
  return (
    calibratedVisualDiameterPx(configuredMm) * layoutScale * getBeadRenderCalibrationFactor()
  );
}

/**
 * Scale one canonical visible diameter to any configured mm.
 * renderDiameterPx = visibleDiameterPx × (configuredMm / referenceMm) × layoutScale × calibrationFactor
 */
export function layoutDiameterFromCanonicalAsset(
  configuredMm: number,
  visibleDiameterPx: number,
  referenceMm: number,
  layoutScale: number,
): number {
  if (
    !Number.isFinite(visibleDiameterPx) ||
    visibleDiameterPx <= 0 ||
    !Number.isFinite(referenceMm) ||
    referenceMm <= 0
  ) {
    return layoutDiameterPxForMm(configuredMm, layoutScale);
  }
  return (
    visibleDiameterPx *
    (configuredMm / referenceMm) *
    layoutScale *
    getBeadRenderCalibrationFactor()
  );
}

/** Strict mm ordering at a fixed layout scale (for tests and verification). */
export function assertMmDiameterOrdering(
  sizesMm: number[],
  layoutScale = 1,
): boolean {
  const diameters = sizesMm.map((mm) => layoutDiameterPxForMm(mm, layoutScale));
  for (let i = 1; i < diameters.length; i++) {
    if (diameters[i]! <= diameters[i - 1]!) return false;
  }
  return true;
}
