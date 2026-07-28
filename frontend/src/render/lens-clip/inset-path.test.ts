import { describe, expect, it } from "vitest";

import { insetClosedPathD, innerFrameRingPathD, sampleClosedPathD } from "./inset-path";

const RECT = "M 10 10 L 90 10 L 90 50 L 10 50 Z";

describe("sampleClosedPathD", () => {
  it("samples a closed rectangle into a dense polyline", () => {
    const pts = sampleClosedPathD(RECT);
    expect(pts.length).toBeGreaterThanOrEqual(4);
    expect(pts[0]).toEqual({ x: 10, y: 10 });
  });
});

describe("insetClosedPathD", () => {
  it("returns empty for non-positive thickness", () => {
    expect(insetClosedPathD(RECT, 0)).toBe("");
    expect(insetClosedPathD(RECT, -1)).toBe("");
  });

  it("produces a smaller closed path inside the original", () => {
    const inset = insetClosedPathD(RECT, 4);
    expect(inset).toMatch(/^M /);
    expect(inset).toMatch(/ Z$/);
    const pts = sampleClosedPathD(inset);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeGreaterThan(10);
    expect(Math.max(...xs)).toBeLessThan(90);
    expect(Math.min(...ys)).toBeGreaterThan(10);
    expect(Math.max(...ys)).toBeLessThan(50);
  });
});

describe("innerFrameRingPathD", () => {
  it("returns null when thickness is zero", () => {
    expect(innerFrameRingPathD(RECT, 0)).toBeNull();
  });

  it("concatenates outer lens and inset hole for even-odd fill", () => {
    const ring = innerFrameRingPathD(RECT, 3);
    expect(ring).toContain(RECT.trim());
    expect(ring).toMatch(/M /g);
    // Outer + inset → at least two M commands.
    expect((ring!.match(/M /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
