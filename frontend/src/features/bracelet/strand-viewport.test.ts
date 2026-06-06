import { describe, expect, it } from "vitest";

import {
  computeStrandAutoFitScale,
  measureStrandCanvasSize,
  squareCanvasSizeForBounds,
} from "./strand-viewport";

describe("measureStrandCanvasSize", () => {
  it("uses more of a large desktop viewport than the old 440px cap", () => {
    const size = measureStrandCanvasSize({
      containerWidth: 1400,
      containerHeight: 900,
      isMobile: false,
      twinning: false,
      libraryOpen: true,
    });
    expect(size).toBeGreaterThan(440);
    expect(size).toBeLessThanOrEqual(760);
  });
});

describe("computeStrandAutoFitScale", () => {
  it("downscales when layout canvas exceeds viewport budget", () => {
    expect(computeStrandAutoFitScale(400, 520)).toBeCloseTo(400 / 520, 5);
  });

  it("never upscales above 1", () => {
    expect(computeStrandAutoFitScale(500, 400)).toBe(1);
  });
});

describe("squareCanvasSizeForBounds", () => {
  it("includes padding on all sides", () => {
    const side = squareCanvasSizeForBounds(
      { minX: 10, maxX: 110, minY: 20, maxY: 120 },
      16,
    );
    expect(side).toBe(132);
  });
});
