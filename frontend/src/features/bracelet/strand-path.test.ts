import { describe, expect, it } from "vitest";

import {
  beadIndexFromPointerAngle,
  computeBeadShellPosition,
  computeSequentialStrandPathLayout,
  computeSymmetricStrandPathLayout,
  computeBalancedRadialStrandPathLayout,
  computeStrandPathLayout,
  easeOutCubic,
  evenBeadAngleRad,
  evenBeadAngleStepRad,
  insertionIndexFromPointerAngle,
  polarToCartesian,
  radialInwardRotationDeg,
  radialOutwardRotationDeg,
  resolveStrandDropTarget,
  solveClosedTangentRingRadiusPx,
  strandRotationDeg,
  tangentRotationDeg,
} from "./strand-path";
import { resolveStrandRenderConfigForType } from "@/render/bead-crop/strand-render-profile";
import { TEST_STRAND_RENDER_CATALOGUE } from "@/render/bead-crop/strand-render-test-catalogue";

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

describe("computeSequentialStrandPathLayout", () => {
  const base = {
    centerX: 200,
    centerY: 200,
    radius: 100,
    startAngle: -Math.PI / 2,
  };

  it("preserves input order and anchors the first bead regardless of footprints", () => {
    const layout = computeSequentialStrandPathLayout({
      ...base,
      beads: [
        { index: 9, occupancyPx: 12, visualRadiusPx: 8 },
        { index: 3, occupancyPx: 12, visualRadiusPx: 20 },
        { index: 7, occupancyPx: 12, visualRadiusPx: 5 },
      ],
    });

    expect(layout.beads.map((bead) => bead.index)).toEqual([9, 3, 7]);
    expect(layout.beads[0]!.angle).toBeCloseTo(base.startAngle, 6);
  });

  it("uses adjacent rendered radii and never redistributes earlier beads", () => {
    const uniform = computeSequentialStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 2, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 3, occupancyPx: 10, visualRadiusPx: 5 },
      ],
    });
    const mixed = computeSequentialStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 2, occupancyPx: 10, visualRadiusPx: 14 },
        { index: 3, occupancyPx: 10, visualRadiusPx: 5 },
      ],
    });

    // Replacing bead 2 changes only its own and subsequent placement; prior centres stay put.
    expect(mixed.beads[0]!.angle).toBeCloseTo(uniform.beads[0]!.angle, 6);
    expect(mixed.beads[1]!.angle).toBeCloseTo(uniform.beads[1]!.angle, 6);
    expect(mixed.beads[2]!.angle).toBeGreaterThan(uniform.beads[2]!.angle);

    const delta12 = mixed.beads[2]!.angle - mixed.beads[1]!.angle;
    const centreDistancePx = delta12 * base.radius;
    expect(centreDistancePx).toBeCloseTo(5 + 14, 5);
  });

  it("applies contact adjustment locally without compression or count-based spreading", () => {
    const layout = computeSequentialStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5, contactAdjustmentPx: 2 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 7, contactAdjustmentPx: 4 },
        { index: 2, occupancyPx: 10, visualRadiusPx: 6 },
      ],
    });

    const firstDeltaPx =
      (layout.beads[1]!.angle - layout.beads[0]!.angle) * base.radius;
    const secondDeltaPx =
      (layout.beads[2]!.angle - layout.beads[1]!.angle) * base.radius;
    expect(firstDeltaPx).toBeCloseTo(5 + 7 + (2 + 4) / 2, 5);
    expect(secondDeltaPx).toBeCloseTo(7 + 6 + (4 + 0) / 2, 5);
  });
});

describe("computeSymmetricStrandPathLayout", () => {
  const base = {
    centerX: 200,
    centerY: 200,
    radius: 100,
    startAngle: -Math.PI / 2,
  };

  it("alternates right and left from the anchored top bead without reordering", () => {
    const layout = computeSymmetricStrandPathLayout({
      ...base,
      beads: Array.from({ length: 7 }, (_, index) => ({
        index,
        occupancyPx: 10,
        visualRadiusPx: 5,
      })),
    });
    const angles = layout.beads.map((bead) => bead.angle);

    expect(layout.beads.map((bead) => bead.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(angles[0]).toBeCloseTo(base.startAngle, 6);
    expect(angles[1]!).toBeGreaterThan(base.startAngle);
    expect(angles[2]!).toBeLessThan(base.startAngle);
    expect(angles[3]!).toBeGreaterThan(angles[1]!);
    expect(angles[4]!).toBeLessThan(angles[2]!);
    expect(angles[5]!).toBeGreaterThan(angles[3]!);
    expect(angles[6]!).toBeLessThan(angles[4]!);
  });

  it("keeps both side chains touching by their rendered radii", () => {
    const layout = computeSymmetricStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 8 },
        { index: 2, occupancyPx: 10, visualRadiusPx: 6 },
        { index: 3, occupancyPx: 10, visualRadiusPx: 7 },
        { index: 4, occupancyPx: 10, visualRadiusPx: 9 },
      ],
    });
    const angles = layout.beads.map((bead) => bead.angle);

    expect((angles[1]! - angles[0]!) * base.radius).toBeCloseTo(5 + 8, 5);
    expect((angles[0]! - angles[2]!) * base.radius).toBeCloseTo(5 + 6, 5);
    expect((angles[3]! - angles[1]!) * base.radius).toBeCloseTo(8 + 7, 5);
    expect((angles[2]! - angles[4]!) * base.radius).toBeCloseTo(6 + 9, 5);
  });

  it("does not redistribute the opposite side when one footprint changes", () => {
    const beads = Array.from({ length: 5 }, (_, index) => ({
      index,
      occupancyPx: 10,
      visualRadiusPx: 5,
    }));
    const original = computeSymmetricStrandPathLayout({ ...base, beads });
    const changed = computeSymmetricStrandPathLayout({
      ...base,
      beads: beads.map((bead) =>
        bead.index === 3 ? { ...bead, visualRadiusPx: 12 } : bead,
      ),
    });

    // Bead 3 is on the right chain; top and every left-chain bead stay fixed.
    expect(changed.beads[0]!.angle).toBeCloseTo(original.beads[0]!.angle, 6);
    expect(changed.beads[2]!.angle).toBeCloseTo(original.beads[2]!.angle, 6);
    expect(changed.beads[4]!.angle).toBeCloseTo(original.beads[4]!.angle, 6);
    expect(changed.beads[3]!.angle).toBeGreaterThan(original.beads[3]!.angle);
  });

  it("never allows negative contact adjustment to overlap visual footprints", () => {
    const layout = computeSymmetricStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5, contactAdjustmentPx: -8 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 7, contactAdjustmentPx: -8 },
      ],
    });

    const distancePx =
      (layout.beads[1]!.angle - layout.beads[0]!.angle) * base.radius;
    expect(distancePx).toBeCloseTo(5 + 7, 5);
  });
});

describe("computeBalancedRadialStrandPathLayout", () => {
  const base = {
    centerX: 200,
    centerY: 200,
    radius: 100,
    startAngle: -Math.PI / 2,
  };
  const circumference = 2 * Math.PI * base.radius;

  const clockwiseAngle = (from: number, to: number) => {
    const delta = (to - from) % (2 * Math.PI);
    return delta < 0 ? delta + 2 * Math.PI : delta;
  };

  const shortestAngle = (from: number, to: number) =>
    Math.min(clockwiseAngle(from, to), clockwiseAngle(to, from));

  const equalBeads = (count: number, occupancyPx = 8) =>
    Array.from({ length: count }, (_, index) => ({
      index,
      occupancyPx,
      visualRadiusPx: occupancyPx / 2,
    }));

  it("keeps the first four visual anchors at top, bottom, right, and left", () => {
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: false,
      beads: equalBeads(4),
    });

    expect(layout.beads.map((bead) => bead.index)).toEqual([0, 1, 2, 3]);
    expect(layout.beads[0]!.angle).toBeCloseTo(base.startAngle, 6);
    expect(clockwiseAngle(base.startAngle, layout.beads[1]!.angle)).toBeCloseTo(Math.PI, 6);
    expect(clockwiseAngle(base.startAngle, layout.beads[2]!.angle)).toBeCloseTo(Math.PI / 2, 6);
    expect(clockwiseAngle(base.startAngle, layout.beads[3]!.angle)).toBeCloseTo(3 * Math.PI / 2, 6);
  });

  it("uses the requested non-clockwise largest-gap sequence for the first eight beads", () => {
    const expectedFractions = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.875, 0.375];
    for (let count = 1; count <= expectedFractions.length; count++) {
      const layout = computeBalancedRadialStrandPathLayout({
        ...base,
        balanceSpacing: false,
        beads: equalBeads(count),
      });
      expect(
        clockwiseAngle(base.startAngle, layout.beads[count - 1]!.angle) / (2 * Math.PI),
      ).toBeCloseTo(expectedFractions[count - 1]!, 6);
    }
  });

  it.each([5, 8, 12, 20, 30])(
    "puts bead %i into a largest empty gap without moving earlier beads when it fits",
    (count) => {
      const before = computeBalancedRadialStrandPathLayout({
        ...base,
        balanceSpacing: false,
        beads: equalBeads(count - 1, 4),
      });
      const after = computeBalancedRadialStrandPathLayout({
        ...base,
        balanceSpacing: false,
        beads: equalBeads(count, 4),
      });
      const ordered = [...before.beads].sort((a, b) =>
        clockwiseAngle(base.startAngle, a.angle) -
        clockwiseAngle(base.startAngle, b.angle),
      );
      const emptyGaps = ordered.map((left, index) => {
        const right = ordered[(index + 1) % ordered.length]!;
        return clockwiseAngle(left.angle, right.angle) * base.radius - 4;
      });
      const inserted = after.beads[count - 1]!;
      const containingGapIndex = ordered.findIndex((left, index) => {
        const right = ordered[(index + 1) % ordered.length]!;
        return (
          clockwiseAngle(left.angle, inserted.angle) <=
          clockwiseAngle(left.angle, right.angle) + 1e-8
        );
      });

      expect(emptyGaps[containingGapIndex]!).toBeCloseTo(Math.max(...emptyGaps), 5);
      for (let index = 0; index < count - 1; index++) {
        expect(shortestAngle(before.beads[index]!.angle, after.beads[index]!.angle)).toBeLessThan(
          1e-8,
        );
      }
    },
  );

  it("measures largest gaps edge-to-edge using mixed occupancies", () => {
    const occupancies = [8, 20, 12, 30, 10];
    const before = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: false,
      beads: occupancies.slice(0, 4).map((occupancyPx, index) => ({
        index,
        occupancyPx,
        visualRadiusPx: occupancyPx / 2,
      })),
    });
    const after = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: false,
      beads: occupancies.map((occupancyPx, index) => ({
        index,
        occupancyPx,
        visualRadiusPx: occupancyPx / 2,
      })),
    });
    const order = [0, 2, 1, 3];
    const gaps = order.map((leftIndex, slot) => {
      const rightIndex = order[(slot + 1) % order.length]!;
      return (
        clockwiseAngle(before.beads[leftIndex]!.angle, before.beads[rightIndex]!.angle) *
          base.radius -
        occupancies[leftIndex]! / 2 -
        occupancies[rightIndex]! / 2
      );
    });
    const selectedSlot = order.findIndex((leftIndex, slot) => {
      const rightIndex = order[(slot + 1) % order.length]!;
      return (
        clockwiseAngle(before.beads[leftIndex]!.angle, after.beads[4]!.angle) <=
        clockwiseAngle(
          before.beads[leftIndex]!.angle,
          before.beads[rightIndex]!.angle,
        ) +
          1e-8
      );
    });

    expect(gaps[selectedSlot]!).toBeCloseTo(Math.max(...gaps), 5);
  });

  it("maintains occupancy spacing after local relaxation near capacity", () => {
    const radius = 180 / (2 * Math.PI);
    const occupancyPx = 18;
    const before = computeBalancedRadialStrandPathLayout({
      centerX: 0,
      centerY: 0,
      radius,
      balanceSpacing: false,
      beads: equalBeads(8, occupancyPx),
    });
    const layout = computeBalancedRadialStrandPathLayout({
      centerX: 0,
      centerY: 0,
      radius,
      balanceSpacing: false,
      beads: equalBeads(9, occupancyPx),
    });
    const ordered = [...layout.beads].sort((a, b) => a.angle - b.angle);

    expect(layout.isOverCapacity).toBe(false);
    for (let index = 0; index < ordered.length; index++) {
      const left = ordered[index]!;
      const right = ordered[(index + 1) % ordered.length]!;
      expect(clockwiseAngle(left.angle, right.angle) * radius).toBeGreaterThanOrEqual(
        occupancyPx - 1e-6,
      );
    }
    const movedExisting = before.beads.filter(
      (bead, index) => shortestAngle(bead.angle, layout.beads[index]!.angle) > 1e-8,
    );
    expect(movedExisting.length).toBeGreaterThan(0);
    expect(movedExisting.length).toBeLessThan(before.beads.length);
    expect(layout.occupiedArcPx).toBeCloseTo(9 * occupancyPx, 5);
  });

  const emptyGapVariance = (
    layout: ReturnType<typeof computeBalancedRadialStrandPathLayout>,
    widthsPx: number[],
  ) => {
    const ordered = [...layout.beads].sort(
      (a, b) =>
        clockwiseAngle(base.startAngle, a.angle) - clockwiseAngle(base.startAngle, b.angle),
    );
    const empties = ordered.map((left, index) => {
      const right = ordered[(index + 1) % ordered.length]!;
      return (
        clockwiseAngle(left.angle, right.angle) * base.radius -
        widthsPx[left.index]! / 2 -
        widthsPx[right.index]! / 2
      );
    });
    const mean = empties.reduce((sum, value) => sum + value, 0) / empties.length;
    return empties.reduce((sum, value) => sum + (value - mean) ** 2, 0) / empties.length;
  };

  it("keeps pure physical positions when Balance Spacing is OFF", () => {
    const off = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: false,
      beads: equalBeads(8),
    });
    const expectedFractions = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.875, 0.375];
    expectedFractions.forEach((fraction, index) => {
      expect(clockwiseAngle(base.startAngle, off.beads[index]!.angle) / (2 * Math.PI)).toBeCloseTo(
        fraction,
        6,
      );
    });
  });

  it("equalises empty gaps when Balance Spacing is ON without rotating bead 0", () => {
    const widths = [10, 22, 14, 28, 12, 18, 8, 16];
    const beads = widths.map((occupancyPx, index) => ({
      index,
      occupancyPx,
      visualRadiusPx: occupancyPx / 2,
    }));
    const off = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: false,
      beads,
    });
    const on = computeBalancedRadialStrandPathLayout({
      ...base,
      balanceSpacing: true,
      beads,
    });

    expect(on.beads[0]!.angle).toBeCloseTo(off.beads[0]!.angle, 6);
    expect(on.occupiedArcPx).toBeCloseTo(off.occupiedArcPx, 6);
    expect(emptyGapVariance(on, widths)).toBeLessThan(emptyGapVariance(off, widths) - 1e-6);

    const ordered = [...on.beads].sort(
      (a, b) =>
        clockwiseAngle(base.startAngle, a.angle) - clockwiseAngle(base.startAngle, b.angle),
    );
    for (let index = 0; index < ordered.length; index++) {
      const left = ordered[index]!;
      const right = ordered[(index + 1) % ordered.length]!;
      expect(clockwiseAngle(left.angle, right.angle) * base.radius).toBeGreaterThanOrEqual(
        widths[left.index]! / 2 + widths[right.index]! / 2 - 1e-6,
      );
    }

    // Mixed sizes must not collapse to equal angles.
    const centreSteps = ordered.map((left, index) => {
      const right = ordered[(index + 1) % ordered.length]!;
      return clockwiseAngle(left.angle, right.angle);
    });
    expect(Math.max(...centreSteps) - Math.min(...centreSteps)).toBeGreaterThan(1e-3);
  });

  it("defaults Balance Spacing to ON", () => {
    const widths = [10, 22, 14, 28, 12];
    const beads = widths.map((occupancyPx, index) => ({
      index,
      occupancyPx,
      visualRadiusPx: occupancyPx / 2,
    }));
    const defaults = computeBalancedRadialStrandPathLayout({ ...base, beads });
    const on = computeBalancedRadialStrandPathLayout({ ...base, balanceSpacing: true, beads });
    defaults.beads.forEach((bead, index) => {
      expect(bead.angle).toBeCloseTo(on.beads[index]!.angle, 8);
    });
  });
});

describe("easeOutCubic", () => {
  it("starts at 0, ends at 1, and rises quickly then levels off", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("charm strand presentation", () => {
  it("faces charms outward from the ring center", () => {
    expect(radialOutwardRotationDeg(0)).toBeCloseTo(90, 5);
    expect(radialOutwardRotationDeg(Math.PI / 2)).toBeCloseTo(180, 5);
    expect(radialOutwardRotationDeg(-Math.PI / 2)).toBeCloseTo(0, 5);
  });

  it("faces inward opposite to outward", () => {
    const angle = Math.PI / 4;
    expect(radialInwardRotationDeg(angle)).toBeCloseTo(radialOutwardRotationDeg(angle) + 180, 5);
  });

  it("uses outward orientation for charms and crystals by default", () => {
    const angle = -Math.PI / 2;
    const charmProfile = resolveStrandRenderConfigForType("charm", TEST_STRAND_RENDER_CATALOGUE);
    const crystalProfile = resolveStrandRenderConfigForType("crystal", TEST_STRAND_RENDER_CATALOGUE);
    expect(strandRotationDeg(angle, charmProfile)).toBeCloseTo(
      radialInwardRotationDeg(angle),
      5,
    );
    expect(strandRotationDeg(angle, crystalProfile)).toBeCloseTo(
      radialInwardRotationDeg(angle),
      5,
    );
  });

  it("legacy tangent rotation matches radialOutward (previous default appearance)", () => {
    const angle = Math.PI / 6;
    expect(tangentRotationDeg(angle)).toBeCloseTo(radialOutwardRotationDeg(angle), 5);
  });

  it("respects inward orientation override", () => {
    const angle = -Math.PI / 2;
    const inwardProfile = {
      ...resolveStrandRenderConfigForType("crystal", TEST_STRAND_RENDER_CATALOGUE),
      orientationMode: "inward" as const,
    };
    expect(strandRotationDeg(angle, inwardProfile)).toBeCloseTo(
      radialOutwardRotationDeg(angle),
      5,
    );
  });

  it("anchors charm loop on the ring point", () => {
    const profile = resolveStrandRenderConfigForType("charm", TEST_STRAND_RENDER_CATALOGUE);
    const dim = { width: 40, height: 50 };
    const ringX = 100;
    const ringY = 100;
    const pos = computeBeadShellPosition(ringX, ringY, -Math.PI / 2, dim, profile);
    expect(pos.top + pos.transformOriginY).toBeCloseTo(ringY, 1);
    expect(pos.left + pos.transformOriginX).toBeCloseTo(ringX, 1);
  });
});
