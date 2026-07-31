import { describe, expect, it } from "vitest";

import { createLensPolygon } from "@/render/mask";

import {
  applySnapToLensEdge,
  createFramePart,
  createFramePartFromLensClip,
  createInsetCutoutFromOuter,
  createScaledCutout,
  duplicateCutout,
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
    expect(rect.holes).toEqual([]);
  });

  it("duplicates a lens clip into an editable Manual Detail outer", () => {
    const lens = createLensPolygon("left", "Left", [
      { x: 0.1, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.4, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.25, y: 0.5, curved: false, handleIn: null, handleOut: null },
    ]);
    const part = createFramePartFromLensClip(lens, "Inner lip L");
    expect(part.id).not.toBe(lens.id);
    expect(part.label).toBe("Inner lip L");
    expect(part.points[0]?.x).toBeCloseTo(0.1);
    expect(part.holes).toEqual([]);
  });

  it("creates scaled and inset cutouts from an outer polygon", () => {
    const outer = createFramePart("Ring", "rectangle").points;
    const scaled = createScaledCutout(outer, "Cutout 1", 0.5);
    expect(scaled.points.length).toBe(4);
    expect(pathBounds(scaled.points).width).toBeLessThan(pathBounds(outer).width);

    const inset = createInsetCutoutFromOuter(outer, 1000, 500, 8, "Cutout 2");
    expect(inset).not.toBeNull();
    expect(inset!.points.length).toBeGreaterThanOrEqual(3);
    expect(pathBounds(inset!.points).width).toBeLessThan(pathBounds(outer).width);

    const copy = duplicateCutout(scaled, "Cutout copy");
    expect(copy.id).not.toBe(scaled.id);
    expect(copy.points[0]!.x).toBeGreaterThan(scaled.points[0]!.x);
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
