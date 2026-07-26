import { describe, expect, it } from "vitest";

import {
  computeGlassSheetPlacement,
  resolveGlassSheetViewBox,
} from "./glass-sheet-layout";

describe("glass-sheet-layout", () => {
  it("resolves a normalized crop into natural-pixel viewBox", () => {
    expect(resolveGlassSheetViewBox(1000, 500, { x: 0.1, y: 0.2, width: 0.5, height: 0.4 })).toEqual(
      { x: 100, y: 100, width: 500, height: 200 },
    );
  });

  it("covers the lens bounds without equal-angle assumptions", () => {
    const placement = computeGlassSheetPlacement({
      bounds: {
        minX: 100,
        minY: 50,
        maxX: 300,
        maxY: 150,
        cx: 200,
        cy: 100,
        width: 200,
        height: 100,
      },
      naturalWidth: 1600,
      naturalHeight: 900,
      fit: "cover",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(placement.width).toBeCloseTo(208, 5);
    expect(placement.height).toBeCloseTo(208 / (1600 / 900), 5);
    expect(placement.width).toBeGreaterThan(placement.height);
  });

  it("applies contain fit and scale", () => {
    const base = computeGlassSheetPlacement({
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 200,
        maxY: 100,
        cx: 100,
        cy: 50,
        width: 200,
        height: 100,
      },
      naturalWidth: 100,
      naturalHeight: 100,
      fit: "contain",
      scale: 1,
    });
    const scaled = computeGlassSheetPlacement({
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 200,
        maxY: 100,
        cx: 100,
        cy: 50,
        width: 200,
        height: 100,
      },
      naturalWidth: 100,
      naturalHeight: 100,
      fit: "contain",
      scale: 1.5,
    });
    expect(scaled.width).toBeCloseTo(base.width * 1.5, 5);
    expect(scaled.height).toBeCloseTo(base.height * 1.5, 5);
  });
});
