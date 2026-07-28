import { describe, expect, it } from "vitest";

import {
  applySnapToLensEdge,
  createFramePart,
  pathBounds,
  rotateAnchors,
  scaleAnchors,
  translateAnchors,
} from "./frame-parts";

describe("frame-parts", () => {
  it("creates rectangle and ellipse starting shapes with enough points", () => {
    const rect = createFramePart("Bridge", "rectangle");
    const ellipse = createFramePart("Pad", "ellipse");
    const free = createFramePart("Custom", "free");
    expect(rect.points.length).toBe(4);
    expect(ellipse.points.length).toBe(12);
    expect(free.points.length).toBe(0);
    expect(rect.label).toBe("Bridge");
  });

  it("translates, scales, and rotates whole polygons", () => {
    const part = createFramePart("Bridge", "rectangle");
    const moved = translateAnchors(part.points, 0.05, -0.02);
    expect(moved[0]!.x).toBeCloseTo((part.points[0]?.x ?? 0) + 0.05, 5);

    const bounds = pathBounds(part.points);
    const scaled = scaleAnchors(part.points, 1.5, 1.5, bounds.cx, bounds.cy);
    const scaledBounds = pathBounds(scaled);
    expect(scaledBounds.width).toBeGreaterThan(bounds.width);

    const rotated = rotateAnchors(part.points, Math.PI / 2, bounds.cx, bounds.cy);
    expect(rotated).toHaveLength(part.points.length);
  });

  it("keeps snap-to-lens-edge as a no-op until enabled", () => {
    const part = createFramePart("Bridge", "rectangle");
    const same = applySnapToLensEdge(part.points, { enabled: false });
    expect(same[0]!.x).toBeCloseTo(part.points[0]!.x, 5);
    const stillSame = applySnapToLensEdge(part.points, {
      enabled: true,
      lensOpenings: [],
    });
    expect(stillSame[0]!.x).toBeCloseTo(part.points[0]!.x, 5);
  });
});
