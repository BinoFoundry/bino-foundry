import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR } from "@bino-foundry/shared/types";

import {
  calibratedVisualDiameterPx,
  VISUAL_BEAD_BASE_PX,
  VISUAL_BEAD_MAX_PX,
  VISUAL_PX_PER_MM,
  VISUAL_SIZE_CURVE_ANCHOR_MM,
  VISUAL_SIZE_CURVE_EXPONENT,
} from "./visual-bead-scale";
import { getBeadRenderCalibrationFactor, setBeadRenderCalibrationFactor } from "./canonical-strand-mm-scale";
import { mmToBasePx, STRAND_BEAD_VISUAL_SCALE } from "./strand-bead";

const CATALOG_SIZES_MM = [0.1, 0.25, 0.5, 1, 2.5, 4, 6, 8, 10, 12, 15, 20] as const;

describe("calibratedVisualDiameterPx", () => {
  it("anchors the reference size to the legacy linear baseline", () => {
    const linearAtAnchor = VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * VISUAL_SIZE_CURVE_ANCHOR_MM;
    expect(calibratedVisualDiameterPx(VISUAL_SIZE_CURVE_ANCHOR_MM)).toBeCloseTo(linearAtAnchor, 5);
  });

  it("compresses visual jumps between larger sizes", () => {
    const d6 = calibratedVisualDiameterPx(6);
    const d8 = calibratedVisualDiameterPx(8);
    const d10 = calibratedVisualDiameterPx(10);
    expect(d6).toBeLessThan(d8);
    expect(d8).toBeLessThan(d10);
    expect(d10 - d8).toBeLessThan(d8 - d6);
    expect(d10 - d8).toBeLessThan(VISUAL_PX_PER_MM * 2);
  });

  it("is less aggressive than linear mapping at 10 mm", () => {
    const linear10 = VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * 10;
    expect(calibratedVisualDiameterPx(10)).toBeLessThan(linear10);
  });

  it("preserves strict ordering for any positive decimal mm", () => {
    const px = CATALOG_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });

  it("keeps tiny beads visible", () => {
    expect(calibratedVisualDiameterPx(0.1)).toBeGreaterThan(2);
    expect(calibratedVisualDiameterPx(0.1)).toBeLessThan(calibratedVisualDiameterPx(1));
  });

  it("clamps very large beads to the maximum diameter", () => {
    expect(calibratedVisualDiameterPx(40)).toBe(VISUAL_BEAD_MAX_PX);
    expect(calibratedVisualDiameterPx(100)).toBe(VISUAL_BEAD_MAX_PX);
  });

  it("supports arbitrary decimal sizes without breakpoints", () => {
    const samples = [0.11, 0.25, 1, 2.75, 6.5, 14.2];
    const px = samples.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });

  it("uses a sub-linear exponent for smoother catalogue progression", () => {
    expect(VISUAL_SIZE_CURVE_EXPONENT).toBeLessThan(1);
    expect(VISUAL_SIZE_CURVE_EXPONENT).toBeGreaterThan(0.5);
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
