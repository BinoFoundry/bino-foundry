import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR } from "@bino-foundry/shared/types";

import {
  calibratedVisualDiameterPx,
  VISUAL_BEAD_MAX_PX,
  VISUAL_PX_PER_MM,
  VISUAL_SIZE_CURVE_ANCHOR_MM,
} from "./visual-bead-scale";
import { getBeadRenderCalibrationFactor, setBeadRenderCalibrationFactor } from "./canonical-strand-mm-scale";
import { mmToBasePx, STRAND_BEAD_VISUAL_SCALE } from "./strand-bead";

const CATALOG_SIZES_MM = [0.1, 0.25, 0.5, 1, 2, 2.5, 4, 6, 8, 10, 12, 15, 20] as const;

describe("calibratedVisualDiameterPx", () => {
  it("is strictly proportional to catalogue mm with no fixed offset", () => {
    for (const mm of [2, 2.5, 4, 6, 8, 10, 12]) {
      expect(calibratedVisualDiameterPx(mm)).toBeCloseTo(VISUAL_PX_PER_MM * mm, 5);
    }
  });

  it("anchors 8 mm to the linear px-per-mm scale", () => {
    expect(calibratedVisualDiameterPx(VISUAL_SIZE_CURVE_ANCHOR_MM)).toBeCloseTo(
      VISUAL_PX_PER_MM * VISUAL_SIZE_CURVE_ANCHOR_MM,
      5,
    );
  });

  it("preserves diameter ratios across catalogue sizes", () => {
    const d6 = calibratedVisualDiameterPx(6);
    const d8 = calibratedVisualDiameterPx(8);
    const d10 = calibratedVisualDiameterPx(10);
    expect(d6 / d8).toBeCloseTo(6 / 8, 5);
    expect(d10 / d8).toBeCloseTo(10 / 8, 5);
  });

  it("preserves strict ordering for any positive decimal mm", () => {
    const px = CATALOG_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });

  it("keeps tiny beads ordered without a fixed +N px bump", () => {
    expect(calibratedVisualDiameterPx(0.1)).toBeCloseTo(VISUAL_PX_PER_MM * 0.1, 5);
    expect(calibratedVisualDiameterPx(0.1)).toBeLessThan(calibratedVisualDiameterPx(1));
  });

  it("clamps very large beads to the maximum diameter", () => {
    expect(calibratedVisualDiameterPx(40)).toBe(VISUAL_BEAD_MAX_PX);
    expect(calibratedVisualDiameterPx(100)).toBe(VISUAL_BEAD_MAX_PX);
  });
});

describe("mmToBasePx", () => {
  beforeEach(() => {
    setBeadRenderCalibrationFactor(DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR);
  });

  it("scales proportionally with the canvas scale factor", () => {
    const atOne = mmToBasePx(6, 1);
    const atTwo = mmToBasePx(6, 2);
    expect(atTwo / atOne).toBeCloseTo(2, 5);
  });

  it("applies the global visual density multiplier", () => {
    expect(mmToBasePx(8, 1)).toBeCloseTo(
      calibratedVisualDiameterPx(8) * STRAND_BEAD_VISUAL_SCALE * getBeadRenderCalibrationFactor(),
      5,
    );
  });

  it("scales all mm sizes uniformly when calibration changes", () => {
    setBeadRenderCalibrationFactor(0.9);
    const six = mmToBasePx(6, 1);
    const ten = mmToBasePx(10, 1);
    setBeadRenderCalibrationFactor(0.7);
    expect(mmToBasePx(6, 1) / six).toBeCloseTo(0.7 / 0.9, 5);
    expect(mmToBasePx(10, 1) / ten).toBeCloseTo(0.7 / 0.9, 5);
    expect(mmToBasePx(10, 1) / mmToBasePx(6, 1)).toBeCloseTo(ten / six, 5);
  });
});
