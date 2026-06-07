import { describe, expect, it } from "vitest";

import { calibratedVisualDiameterPx, VISUAL_BEAD_SCALE_ANCHORS } from "./visual-bead-scale";
import { mmToBasePx, STRAND_BEAD_VISUAL_SCALE } from "./strand-bead";

const MIXED_SIZES_MM = [0.5, 2.5, 4, 6, 8, 10] as const;
const CATALOG_SIZES_MM = [0.1, 0.25, 0.5, 1, 2.5, 4, 6, 8, 10, 12, 20] as const;

describe("calibratedVisualDiameterPx", () => {
  it("hits every calibrated anchor exactly", () => {
    for (const { mm, px } of VISUAL_BEAD_SCALE_ANCHORS) {
      expect(calibratedVisualDiameterPx(mm)).toBeCloseTo(px, 5);
    }
  });

  it("preserves strict ordering across the full catalog range", () => {
    const px = CATALOG_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]);
    }
  });

  it("keeps tiny beads visible without collapsing to one size", () => {
    const tiny = [0.1, 0.25, 0.5, 1].map((mm) => calibratedVisualDiameterPx(mm));
    const unique = new Set(tiny.map((v) => v.toFixed(2)));
    expect(unique.size).toBe(tiny.length);
    for (const px of tiny) {
      expect(px).toBeGreaterThanOrEqual(9);
      expect(px).toBeLessThan(calibratedVisualDiameterPx(2.5));
    }
  });

  it("compresses large-bead growth vs linear mm scaling", () => {
    const eight = calibratedVisualDiameterPx(8);
    const ten = calibratedVisualDiameterPx(10);
    const twelve = calibratedVisualDiameterPx(12);
    const twenty = calibratedVisualDiameterPx(20);
    const linearTen = (10 / 8) * eight;
    const linearTwelve = (12 / 8) * eight;
    const linearTwenty = (20 / 8) * eight;
    expect(ten).toBeLessThan(linearTen);
    expect(twelve).toBeLessThan(linearTwelve);
    expect(twenty).toBeLessThan(linearTwenty);
  });

  it("produces a smooth progression for the mixed-size bracelet test set", () => {
    const px = MIXED_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      const stepRatio = px[i] / px[i - 1];
      expect(stepRatio).toBeGreaterThan(1);
      expect(stepRatio).toBeLessThan(1.5);
    }
    expect(px[0]).toBeGreaterThanOrEqual(12);
    expect(px[px.length - 1]).toBeLessThanOrEqual(32);
  });

  it("extrapolates sub-anchor and supra-anchor sizes gently", () => {
    expect(calibratedVisualDiameterPx(0.01)).toBeCloseTo(9, 5);
    expect(calibratedVisualDiameterPx(40)).toBeCloseTo(35, 5);
    expect(calibratedVisualDiameterPx(100)).toBeLessThanOrEqual(35);
  });
});

describe("mmToBasePx", () => {
  it("scales proportionally with the canvas scale factor", () => {
    const atOne = mmToBasePx(6, 1);
    const atTwo = mmToBasePx(6, 2);
    expect(atTwo / atOne).toBeCloseTo(2, 5);
  });

  it("applies the global visual density multiplier", () => {
    expect(mmToBasePx(8, 1)).toBeCloseTo(27 * STRAND_BEAD_VISUAL_SCALE, 5);
  });
});
