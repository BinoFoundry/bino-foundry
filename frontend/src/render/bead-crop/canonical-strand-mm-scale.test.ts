import { describe, expect, it } from "vitest";

import {
  assertMmDiameterOrdering,
  CANONICAL_STRAND_REFERENCE_MM,
  GLOBAL_BEAD_RENDER_SCALE,
  layoutDiameterFromCanonicalAsset,
  layoutDiameterPxForMm,
} from "./canonical-strand-mm-scale";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";

describe("canonical-strand-mm-scale", () => {
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

    expect(six).toBeCloseTo(calibratedVisualDiameterPx(6) * GLOBAL_BEAD_RENDER_SCALE, 5);
    expect(eight).toBeCloseTo(calibratedVisualDiameterPx(8) * GLOBAL_BEAD_RENDER_SCALE, 5);
    expect(ten).toBeCloseTo(calibratedVisualDiameterPx(10) * GLOBAL_BEAD_RENDER_SCALE, 5);

    const ratioBefore = calibratedVisualDiameterPx(8) / calibratedVisualDiameterPx(6);
    expect(eight / six).toBeCloseTo(ratioBefore, 8);
  });
});
