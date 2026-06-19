import { describe, expect, it } from "vitest";

import {
  beadIndexFromPointerAngle,
  beadStrandRotationDeg,
  beadRingAlignOffsetPx,
  computeStrandPathLayout,
  evenBeadAngleRad,
  evenBeadAngleStepRad,
  insertionIndexFromPointerAngle,
  polarToCartesian,
  radialOutwardRotationDeg,
  resolveStrandDropTarget,
  tangentRotationDeg,
} from "./strand-path";

describe("polarToCartesian", () => {
  it("places top of ring at start angle", () => {
    const { x, y } = polarToCartesian(200, 200, 100, -Math.PI / 2);
    expect(x).toBeCloseTo(200, 5);
    expect(y).toBeCloseTo(100, 5);
  });
});

describe("evenBeadAngleRad", () => {
  it("distributes four beads at 90° intervals from 12 o'clock", () => {
    const angles = [0, 1, 2, 3].map((i) => evenBeadAngleRad(i, 4));
    expect(angles[0]).toBeCloseTo(-Math.PI / 2, 5);
    expect(angles[1]).toBeCloseTo(0, 5);
    expect(angles[2]).toBeCloseTo(Math.PI / 2, 5);
    expect(angles[3]).toBeCloseTo(Math.PI, 5);
  });

  it("recalibrates step when n changes", () => {
    expect(evenBeadAngleStepRad(3)).toBeCloseTo((2 * Math.PI) / 3, 5);
    expect(evenBeadAngleStepRad(8)).toBeCloseTo(Math.PI / 4, 5);
  });
});

describe("tangentRotationDeg", () => {
  it("aligns tangent at top of ring to the right (+x)", () => {
    expect(tangentRotationDeg(-Math.PI / 2)).toBeCloseTo(0, 5);
  });
});

describe("beadIndexFromPointerAngle", () => {
  it("maps pointer to the angular sector for each bead", () => {
    expect(beadIndexFromPointerAngle(-Math.PI / 2, 4)).toBe(0);
    expect(beadIndexFromPointerAngle(0, 4)).toBe(1);
    expect(beadIndexFromPointerAngle(Math.PI / 2, 4)).toBe(2);
    expect(beadIndexFromPointerAngle(Math.PI, 4)).toBe(3);
  });
});

describe("insertionIndexFromPointerAngle", () => {
  it("maps pointer to gap indices between beads", () => {
    expect(insertionIndexFromPointerAngle(-Math.PI / 2, 4)).toBe(0);
    expect(insertionIndexFromPointerAngle(-Math.PI / 4, 4)).toBe(1);
    expect(insertionIndexFromPointerAngle(0, 4)).toBe(1);
    expect(insertionIndexFromPointerAngle(Math.PI / 4, 4)).toBe(2);
  });
});

describe("resolveStrandDropTarget", () => {
  it("returns insert for empty strand", () => {
    expect(resolveStrandDropTarget(0, 0)).toEqual({ mode: "insert", index: 0 });
  });

  it("prefers replace when pointer is near bead center", () => {
    expect(resolveStrandDropTarget(-Math.PI / 2, 4)).toEqual({ mode: "replace", index: 0 });
    expect(resolveStrandDropTarget(0, 4)).toEqual({ mode: "replace", index: 1 });
  });

  it("prefers insert when pointer is nearer a gap", () => {
    const gapAngle = -Math.PI / 2 + evenBeadAngleStepRad(4) / 2;
    expect(resolveStrandDropTarget(gapAngle, 4)).toEqual({ mode: "insert", index: 1 });
  });
});

describe("computeStrandPathLayout", () => {
  it("uses elastic arc-length spacing when layoutCircumferenceMm is provided", () => {
    const layout = computeStrandPathLayout({
      beads: [
        { index: 0, beadMm: 6 },
        { index: 1, beadMm: 12 },
        { index: 2, beadMm: 6 },
      ],
      layoutCircumferenceMm: 160,
      centerX: 200,
      centerY: 200,
      radius: 120,
    });
    expect(layout[1]!.arcSpan).toBeGreaterThan(layout[0]!.arcSpan);
    expect(layout[1]!.arcSpan).toBeGreaterThan(layout[2]!.arcSpan);
  });

  it("places beads at even polar angles when bead mm weights are absent", () => {
    const layout = computeStrandPathLayout({
      beads: [
        { index: 0, beadMm: 12, extentPx: 40 },
        { index: 1, beadMm: 6, extentPx: 22 },
        { index: 2, beadMm: 10, extentPx: 35 },
      ],
      centerX: 200,
      centerY: 200,
      radius: 120,
    });
    expect(layout).toHaveLength(3);
    const span = evenBeadAngleStepRad(3);
    layout.forEach((slot, i) => {
      expect(slot.arcSpan).toBeCloseTo(span, 5);
      expect(slot.angle).toBeCloseTo(evenBeadAngleRad(i, 3), 5);
      expect(slot.x).toBeCloseTo(200 + 120 * Math.cos(slot.angle), 3);
      expect(slot.y).toBeCloseTo(200 + 120 * Math.sin(slot.angle), 3);
    });
  });

  it("uses tangent rotation, not radial θᵢ degrees", () => {
    const layout = computeStrandPathLayout({
      beads: [{ index: 0 }],
      centerX: 0,
      centerY: 0,
      radius: 50,
    });
    const top = layout[0]!;
    expect(top.angle).toBeCloseTo(-Math.PI / 2, 5);
    expect(top.rotationDeg).toBeCloseTo(tangentRotationDeg(top.angle), 5);
    expect(top.rotationDeg).not.toBeCloseTo(-90, 5);
  });

  it("recomputes angular step when bead count changes", () => {
    const two = computeStrandPathLayout({
      beads: [{ index: 0 }, { index: 1 }],
      centerX: 100,
      centerY: 100,
      radius: 80,
    });
    const four = computeStrandPathLayout({
      beads: [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }],
      centerX: 100,
      centerY: 100,
      radius: 80,
    });
    expect(two[0]!.angle).toBeCloseTo(four[0]!.angle, 5);
    expect(two[1]!.angle - two[0]!.angle).toBeCloseTo(Math.PI, 5);
    expect(four[1]!.angle - four[0]!.angle).toBeCloseTo(Math.PI / 2, 5);
    expect(two[1]!.angle).not.toBeCloseTo(four[1]!.angle, 3);
  });
});

describe("charm strand presentation", () => {
  it("faces charms outward from the ring center", () => {
    expect(radialOutwardRotationDeg(0)).toBeCloseTo(90, 5);
    expect(radialOutwardRotationDeg(Math.PI / 2)).toBeCloseTo(180, 5);
    expect(radialOutwardRotationDeg(-Math.PI / 2)).toBeCloseTo(0, 5);
  });

  it("uses radial rotation for charms and tangent for crystals", () => {
    const angle = -Math.PI / 2;
    expect(beadStrandRotationDeg(angle, "charm")).toBeCloseTo(0, 5);
    expect(beadStrandRotationDeg(angle, "crystal")).toBeCloseTo(tangentRotationDeg(angle), 5);
  });

  it("pulls charm centers toward the cord", () => {
    const offset = beadRingAlignOffsetPx("charm", { width: 40, height: 50 });
    expect(offset).toBeLessThan(0);
    expect(beadRingAlignOffsetPx("crystal", { width: 40, height: 50 })).toBe(0);
  });
});
