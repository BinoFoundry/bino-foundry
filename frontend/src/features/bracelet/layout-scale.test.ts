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

  it("clamps unsafe global calibration values", () => {
    expect(effectiveLayoutDiameterPx(10, 2)).toBe(11);
    expect(effectiveLayoutDiameterPx(10, 0)).toBe(9);
  });
});
