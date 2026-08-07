import { describe, expect, it } from "vitest";

import { effectiveLayoutDiameterPx } from "./strand-ring-geometry";

describe("effectiveLayoutDiameterPx", () => {
  it("uses measured rendered diameter at the 100% default", () => {
    expect(effectiveLayoutDiameterPx(6, 1)).toBe(6);
  });

  it("calibrates positioning diameter without changing the measured input", () => {
    const measured = 6;
    expect(effectiveLayoutDiameterPx(measured, 1.01)).toBeCloseTo(6.06, 8);
    expect(measured).toBe(6);
  });

  it("applies layout scale 1:1 without hidden clamping", () => {
    expect(effectiveLayoutDiameterPx(10, 2)).toBe(20);
    expect(effectiveLayoutDiameterPx(10, 0.5)).toBe(5);
  });

  it("falls back to 1 for non-finite or non-positive scale", () => {
    expect(effectiveLayoutDiameterPx(10, 0)).toBe(10);
    expect(effectiveLayoutDiameterPx(10, Number.NaN)).toBe(10);
  });
});
