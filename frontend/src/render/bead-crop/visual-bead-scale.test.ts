import { beforeEach, describe, expect, it } from "vitest";

import {
  STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  DEFAULT_BEAD_RENDER_CALIBRATION_FACTOR,
} from "@bino-foundry/shared/types";

import {
  calibratedVisualDiameterPx,
  clampVisualSizeScaling,
  visualSizeCurveRelativeFactor,
  VISUAL_BEAD_MAX_PX,
  VISUAL_PX_PER_MM,
  VISUAL_SIZE_CURVE_ANCHOR_MM,
} from "./visual-bead-scale";
import { getBeadRenderCalibrationFactor, setBeadRenderCalibrationFactor } from "./canonical-strand-mm-scale";
import { mmToBasePx, STRAND_BEAD_VISUAL_SCALE } from "./strand-bead";
import { visualSlotDimensions } from "@/features/bracelet/strand-path";

const CATALOG_SIZES_MM = [0.1, 0.25, 0.5, 1, 2, 2.5, 4, 6, 8, 10, 12, 15, 20] as const;

describe("calibratedVisualDiameterPx", () => {
  it("is strictly proportional to catalogue mm when exponent is 1", () => {
    for (const mm of [2, 2.5, 4, 6, 8, 10, 12]) {
      expect(calibratedVisualDiameterPx(mm, 1)).toBeCloseTo(VISUAL_PX_PER_MM * mm, 5);
    }
  });

  it("anchors the reference size for any exponent", () => {
    const linearAnchor = VISUAL_PX_PER_MM * VISUAL_SIZE_CURVE_ANCHOR_MM;
    for (const exponent of [0.5, 0.6, 0.7, 0.8, 1, 1.25]) {
      expect(calibratedVisualDiameterPx(VISUAL_SIZE_CURVE_ANCHOR_MM, exponent)).toBeCloseTo(
        linearAnchor,
        5,
      );
    }
  });

  it("preserves diameter ratios across catalogue sizes when linear", () => {
    const d6 = calibratedVisualDiameterPx(6, 1);
    const d8 = calibratedVisualDiameterPx(8, 1);
    const d10 = calibratedVisualDiameterPx(10, 1);
    expect(d6 / d8).toBeCloseTo(6 / 8, 5);
    expect(d10 / d8).toBeCloseTo(10 / 8, 5);
  });

  it("compresses 6→8→10 jumps when exponent is below 1 while keeping order", () => {
    const exponent = STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT;
    const d6 = calibratedVisualDiameterPx(6, exponent);
    const d8 = calibratedVisualDiameterPx(8, exponent);
    const d10 = calibratedVisualDiameterPx(10, exponent);

    expect(d6).toBeCloseTo(calibratedVisualDiameterPx(6, 1), 5);
    expect(d6).toBeLessThan(d8);
    expect(d8).toBeLessThan(d10);

    const linear8 = calibratedVisualDiameterPx(8, 1);
    const linear10 = calibratedVisualDiameterPx(10, 1);
    expect(d8 / d6).toBeLessThan(linear8 / calibratedVisualDiameterPx(6, 1));
    expect(d10 / d6).toBeLessThan(linear10 / calibratedVisualDiameterPx(6, 1));
  });

  it("preserves strict ordering for any positive decimal mm", () => {
    const px = CATALOG_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm, 0.7));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });

  it("keeps tiny beads ordered without a fixed +N px bump", () => {
    expect(calibratedVisualDiameterPx(0.1, 1)).toBeCloseTo(VISUAL_PX_PER_MM * 0.1, 5);
    expect(calibratedVisualDiameterPx(0.1, 1)).toBeLessThan(calibratedVisualDiameterPx(1, 1));
  });

  it("clamps very large beads to the maximum diameter", () => {
    expect(calibratedVisualDiameterPx(40, 1)).toBe(VISUAL_BEAD_MAX_PX);
    expect(calibratedVisualDiameterPx(100, 1)).toBe(VISUAL_BEAD_MAX_PX);
  });
});

describe("visualSizeCurveRelativeFactor", () => {
  it("is 1 at the anchor for any exponent", () => {
    expect(visualSizeCurveRelativeFactor(6, 0.5)).toBeCloseTo(1, 8);
    expect(visualSizeCurveRelativeFactor(6, 0.7)).toBeCloseTo(1, 8);
    expect(visualSizeCurveRelativeFactor(6, 1.25)).toBeCloseTo(1, 8);
  });

  it("is 1 for linear scaling at every size", () => {
    for (const mm of [2, 6, 8, 10, 15]) {
      expect(visualSizeCurveRelativeFactor(mm, 1)).toBeCloseTo(1, 8);
    }
  });
});

describe("visualSlotDimensions size curve", () => {
  it("leaves 6mm shells unchanged when only visualSizeScaling changes", () => {
    const dim = { width: 40, height: 40 };
    const linear = visualSlotDimensions(dim, { layoutScale: 1, visualScale: 1, visualSizeScaling: 1 }, 6);
    const curved = visualSlotDimensions(dim, { layoutScale: 1, visualScale: 1, visualSizeScaling: 0.7 }, 6);
    expect(curved.width).toBeCloseTo(linear.width, 5);
    expect(curved.height).toBeCloseTo(linear.height, 5);
  });

  it("shrinks 10mm relative to linear while staying larger than 6mm", () => {
    const dim6 = { width: 30, height: 30 };
    const dim10 = { width: 50, height: 50 };
    const six = visualSlotDimensions(dim6, { layoutScale: 1, visualScale: 1, visualSizeScaling: 0.7 }, 6);
    const tenLinear = visualSlotDimensions(dim10, { layoutScale: 1, visualScale: 1, visualSizeScaling: 1 }, 10);
    const tenCurved = visualSlotDimensions(dim10, { layoutScale: 1, visualScale: 1, visualSizeScaling: 0.7 }, 10);
    expect(tenCurved.width).toBeLessThan(tenLinear.width);
    expect(tenCurved.width).toBeGreaterThan(six.width);
  });
});

describe("clampVisualSizeScaling", () => {
  it("falls back to linear for invalid values", () => {
    expect(clampVisualSizeScaling(Number.NaN)).toBe(1);
    expect(clampVisualSizeScaling(-1)).toBe(1);
    expect(clampVisualSizeScaling(0)).toBe(1);
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

  it("applies the global visual density multiplier on the linear base", () => {
    expect(mmToBasePx(8, 1)).toBeCloseTo(
      calibratedVisualDiameterPx(8, 1) * STRAND_BEAD_VISUAL_SCALE * getBeadRenderCalibrationFactor(),
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
