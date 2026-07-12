import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR } from "@bino-foundry/shared/types";

import {
  assertMmDiameterOrdering,
  CANONICAL_STRAND_REFERENCE_MM,
  getBeadRenderCalibrationFactor,
  layoutDiameterFromCanonicalAsset,
  layoutDiameterPxForMm,
  setBeadRenderCalibrationFactor,
} from "./canonical-strand-mm-scale";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

describe("canonical-strand-mm-scale", () => {
  beforeEach(() => {
    setBeadRenderCalibrationFactor(DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR);
  });

  it("orders diameters strictly by configured mm", () => {
    expect(assertMmDiameterOrdering([2, 4, 6, 8, 10, 12])).toBe(true);
    expect(layoutDiameterPxForMm(6, 1)).toBeLessThan(layoutDiameterPxForMm(8, 1));
    expect(layoutDiameterPxForMm(8, 1)).toBeLessThan(layoutDiameterPxForMm(10, 1));
  });

  it("scales linearly with layout scale", () => {
    const at1 = layoutDiameterPxForMm(8, 1);
    const at2 = layoutDiameterPxForMm(8, 2);
    expect(at2).toBeCloseTo(at1 * 2, 5);
  });

  it("derives any mm from one canonical visible diameter", () => {
    const referenceMm = CANONICAL_STRAND_REFERENCE_MM;
    const visibleAtRef = calibratedVisualDiameterPx(referenceMm);
    const six = layoutDiameterFromCanonicalAsset(6, visibleAtRef, referenceMm, 1);
    const eight = layoutDiameterFromCanonicalAsset(8, visibleAtRef, referenceMm, 1);
    expect(six).toBeLessThan(eight);
  });

  it("applies global render scale uniformly without changing mm ratios", () => {
    const six = layoutDiameterPxForMm(6, 1);
    const eight = layoutDiameterPxForMm(8, 1);
    const ten = layoutDiameterPxForMm(10, 1);

    expect(six).toBeCloseTo(
      calibratedVisualDiameterPx(6) * getBeadRenderCalibrationFactor(),
      5,
    );
    expect(eight).toBeCloseTo(
      calibratedVisualDiameterPx(8) * getBeadRenderCalibrationFactor(),
      5,
    );
    expect(ten).toBeCloseTo(
      calibratedVisualDiameterPx(10) * getBeadRenderCalibrationFactor(),
      5,
    );

    const ratioBefore = calibratedVisualDiameterPx(8) / calibratedVisualDiameterPx(6);
    expect(eight / six).toBeCloseTo(ratioBefore, 8);
  });

  it("scales all sizes uniformly when calibration factor changes", () => {
    setBeadRenderCalibrationFactor(0.9);
    const sixAtNine = layoutDiameterPxForMm(6, 1);
    const tenAtNine = layoutDiameterPxForMm(10, 1);
    setBeadRenderCalibrationFactor(0.7);
    expect(layoutDiameterPxForMm(6, 1) / sixAtNine).toBeCloseTo(0.7 / 0.9, 5);
    expect(layoutDiameterPxForMm(10, 1) / tenAtNine).toBeCloseTo(0.7 / 0.9, 5);
    expect(layoutDiameterPxForMm(10, 1) / layoutDiameterPxForMm(6, 1)).toBeCloseTo(
      tenAtNine / sixAtNine,
      5,
    );
  });
});
