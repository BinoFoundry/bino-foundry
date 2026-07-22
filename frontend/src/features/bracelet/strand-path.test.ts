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
import { balancedFractionsForSequence } from "./balanced-strand-layout";
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

  /** Angular walk order from balanced insertion (top → … clockwise). */
  const angularOrderFor = (count: number) =>
    balancedFractionsForSequence(count)
      .map((fraction, index) => ({ fraction, index }))
      .sort((a, b) => a.fraction - b.fraction);

  it("preserves logical indices and anchors the first bead at the top", () => {
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: Array.from({ length: 3 }, (_, index) => ({
        index,
        occupancyPx: 10,
        visualRadiusPx: 5,
      })),
    });

    expect(layout.beads.map((bead) => bead.index)).toEqual([0, 1, 2]);
    expect(layout.beads[0]!.angle).toBeCloseTo(base.startAngle, 6);
  });

  it("walks balanced angular order: top → right → bottom for three beads", () => {
    const diameter = 10;
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: Array.from({ length: 3 }, (_, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });

    // Angular order for balanced insert: 0 (top), 2 (right), 1 (bottom).
    expect(layout.beads[0]!.angle).toBeCloseTo(base.startAngle, 6);
    expect(Math.hypot(
      layout.beads[0]!.x - layout.beads[2]!.x,
      layout.beads[0]!.y - layout.beads[2]!.y,
    )).toBeCloseTo(diameter, 4);
    expect(Math.hypot(
      layout.beads[2]!.x - layout.beads[1]!.x,
      layout.beads[2]!.y - layout.beads[1]!.y,
    )).toBeCloseTo(diameter, 4);
  });

  it("keeps top/right/bottom/left neighbour order for four beads in contact", () => {
    const diameter = 10;
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: Array.from({ length: 4 }, (_, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });

    // Angular order: 0 → 2 → 1 → 3 (top → right → bottom → left).
    for (const { a, b } of [
      { a: 0, b: 2 },
      { a: 2, b: 1 },
      { a: 1, b: 3 },
    ]) {
      expect(
        Math.hypot(
          layout.beads[a]!.x - layout.beads[b]!.x,
          layout.beads[a]!.y - layout.beads[b]!.y,
        ),
      ).toBeCloseTo(diameter, 4);
    }
  });

  it("recursively fills largest-gap direction order while packing contact", () => {
    const diameter = 8;
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: Array.from({ length: 8 }, (_, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });

    const expectedOrder = angularOrderFor(8).map((entry) => entry.index);
    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const a = expectedOrder[i]!;
      const b = expectedOrder[i + 1]!;
      expect(
        Math.hypot(
          layout.beads[a]!.x - layout.beads[b]!.x,
          layout.beads[a]!.y - layout.beads[b]!.y,
        ),
      ).toBeCloseTo(diameter, 4);
    }
  });

  it("uses resolved footprints while preserving the balanced sequence", () => {
    const mixed = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 1, occupancyPx: 24, visualRadiusPx: 14 },
        { index: 2, occupancyPx: 6, visualRadiusPx: 3 },
        { index: 3, occupancyPx: 18, visualRadiusPx: 9 },
        { index: 4, occupancyPx: 10, visualRadiusPx: 5 },
      ],
    });

    expect(mixed.beads.map((bead) => bead.index)).toEqual([0, 1, 2, 3, 4]);
    expect(mixed.isOverCapacity).toBe(false);
    // Angular order for 5: fractions [0, 0.5, 0.25, 0.75, 0.125] → indices 0,4,2,1,3
    const order = [0, 4, 2, 1, 3];
    const radii = [5, 14, 3, 9, 5];
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i]!;
      const b = order[i + 1]!;
      expect(
        Math.hypot(
          mixed.beads[a]!.x - mixed.beads[b]!.x,
          mixed.beads[a]!.y - mixed.beads[b]!.y,
        ),
      ).toBeCloseTo(radii[a]! + radii[b]!, 3);
    }
  });

  it("sizes arc spans from the resolved footprint chord", () => {
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: [
        { index: 0, occupancyPx: 10, visualRadiusPx: 5 },
        { index: 1, occupancyPx: 10, visualRadiusPx: 12 },
      ],
    });
    expect(layout.beads[0]!.arcSpan).toBeCloseTo(2 * Math.asin(5 / base.radius), 6);
    expect(layout.beads[1]!.arcSpan).toBeCloseTo(2 * Math.asin(12 / base.radius), 6);
  });

  it("leaves unused capacity as one empty arc — not distributed gaps", () => {
    const diameter = 10;
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: Array.from({ length: 6 }, (_, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });

    const order = angularOrderFor(6);
    const pairGaps: number[] = [];
    for (let i = 0; i < order.length; i++) {
      const a = layout.beads[order[i]!.index]!;
      const b = layout.beads[order[(i + 1) % order.length]!.index]!;
      pairGaps.push(Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - diameter));
    }
    // Open-chain neighbours touch; only the closure pair holds the unfinished empty arc.
    for (let i = 0; i < pairGaps.length - 1; i++) {
      expect(pairGaps[i]!).toBeLessThan(0.5);
    }
    expect(pairGaps[pairGaps.length - 1]!).toBeGreaterThan(diameter);
  });

  it("closes with no residual gap when occupied length equals circumference", () => {
    const circumference = 2 * Math.PI * base.radius;
    const beadWidth = circumference / 30;
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      compressionRatio: 1,
      beads: Array.from({ length: 30 }, (_, index) => ({
        index,
        occupancyPx: beadWidth,
        visualRadiusPx: beadWidth / 2,
      })),
    });

    const angular = [...layout.beads].sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < angular.length; i++) {
      const a = angular[i]!;
      const b = angular[(i + 1) % angular.length]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(beadWidth, 4);
    }
    expect(layout.isOverCapacity).toBe(false);
  });

  it("calibrates 30 × 6 mm contacts on an 18 cm wrist into a tangent closed loop", () => {
    // 18 cm wrist ⇒ 180 mm circumference. Thirty 6 mm rendered contacts fill capacity.
    const wristCircumferenceMm = 180;
    const diameterPx = 6;
    const nominalRadiusPx = wristCircumferenceMm / (2 * Math.PI);
    const layout = computeBalancedRadialStrandPathLayout({
      centerX: 0,
      centerY: 0,
      radius: nominalRadiusPx,
      startAngle: -Math.PI / 2,
      closeLoop: true,
      beads: Array.from({ length: 30 }, (_, index) => ({
        index,
        occupancyPx: diameterPx,
        visualRadiusPx: diameterPx / 2,
      })),
    });

    expect(layout.resolvedRadiusPx).toBeCloseTo(
      diameterPx / (2 * Math.sin(Math.PI / 30)),
      6,
    );
    expect(layout.occupiedArcPx).toBeCloseTo(2 * Math.PI * layout.resolvedRadiusPx!, 5);
    const angular = layout.beads
      .map((bead, index) => ({ bead, index }))
      .sort((a, b) => a.bead.angle - b.bead.angle);
    for (let i = 0; i < angular.length; i++) {
      const a = angular[i]!.bead;
      const b = angular[(i + 1) % angular.length]!.bead;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(diameterPx, 5);
    }
  });

  it("keeps mixed round/spacer/charm contacts tangent without collisions", () => {
    const diameters = [6, 8, 4, 12, 6, 5, 8, 7];
    const radii = diameters.map((d) => d / 2);
    const solved = solveClosedTangentRingRadiusPx(radii, 12);
    const layout = computeBalancedRadialStrandPathLayout({
      centerX: 100,
      centerY: 100,
      radius: solved,
      closeLoop: true,
      beads: diameters.map((diameter, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });

    const fractions = [0, 0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875];
    const angularOrder = fractions
      .map((fraction, index) => ({ fraction, index }))
      .sort((a, b) => a.fraction - b.fraction);
    for (let i = 0; i < angularOrder.length; i++) {
      const currentIndex = angularOrder[i]!.index;
      const nextIndex = angularOrder[(i + 1) % angularOrder.length]!.index;
      const a = layout.beads[currentIndex]!;
      const b = layout.beads[nextIndex]!;
      const expectedContact = (diameters[currentIndex]! + diameters[nextIndex]!) / 2;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(expectedContact, 5);
    }
    expect(layout.beads.map((bead) => bead.index)).toEqual(diameters.map((_, i) => i));
  });

  it("keeps neighbour contact at every fill level with one shrinking empty arc", () => {
    const wristCircumferencePx = 180;
    const radius = wristCircumferencePx / (2 * Math.PI);
    const visualDiameterPx = 6;
    const capacityBeadMm = 6;
    const wristMm = 180;
    const counts = [5, 10, 15, 20, 25, 28, 29, 30] as const;

    const chainStats = (count: number) => {
      const compressionRatio = (count * capacityBeadMm) / wristMm;
      const layout = computeBalancedRadialStrandPathLayout({
        centerX: 0,
        centerY: 0,
        radius,
        startAngle: -Math.PI / 2,
        compressionRatio,
        beads: Array.from({ length: count }, (_, index) => ({
          index,
          occupancyPx: visualDiameterPx,
          visualRadiusPx: visualDiameterPx / 2,
        })),
      });
      const order = angularOrderFor(count);
      let openGapMax = 0;
      for (let i = 0; i < order.length - 1; i++) {
        const a = layout.beads[order[i]!.index]!;
        const b = layout.beads[order[i + 1]!.index]!;
        openGapMax = Math.max(
          openGapMax,
          Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - visualDiameterPx),
        );
      }
      // Unused capacity is the leftover arc after the open contact chain — not the
      // Euclidean chord between endpoints (that chord spans the occupied cluster).
      const emptyArcPx = Math.max(0, wristCircumferencePx - layout.occupiedArcPx);
      return { openGapMax, emptyArcPx, layout };
    };

    const stats = counts.map((count) => chainStats(count));
    for (const s of stats.slice(0, -1)) {
      expect(s.openGapMax).toBeLessThan(0.05);
      expect(s.emptyArcPx).toBeGreaterThan(0.5);
    }
    for (let i = 1; i < stats.length - 1; i++) {
      expect(stats[i]!.emptyArcPx).toBeLessThanOrEqual(stats[i - 1]!.emptyArcPx + 1e-6);
    }
    // Full bracelet: closed tangent loop — every neighbour including closure touches.
    const full = stats[stats.length - 1]!;
    expect(full.layout.resolvedRadiusPx).toBeDefined();
    const fullOrder = angularOrderFor(30);
    for (let i = 0; i < fullOrder.length; i++) {
      const a = full.layout.beads[fullOrder[i]!.index]!;
      const b = full.layout.beads[fullOrder[(i + 1) % fullOrder.length]!.index]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(visualDiameterPx, 4);
    }
  });

  it("matches closed-loop tangency whether driven by compressionRatio or closeLoop", () => {
    const diameterPx = 6;
    const beads = Array.from({ length: 30 }, (_, index) => ({
      index,
      occupancyPx: diameterPx,
      visualRadiusPx: diameterPx / 2,
    }));
    const closedBase = {
      centerX: 0,
      centerY: 0,
      radius: 180 / (2 * Math.PI),
      startAngle: -Math.PI / 2,
      beads,
    };
    const viaRatio = computeBalancedRadialStrandPathLayout({
      ...closedBase,
      compressionRatio: 1,
    });
    const viaFlag = computeBalancedRadialStrandPathLayout({
      ...closedBase,
      closeLoop: true,
    });
    expect(viaRatio.resolvedRadiusPx).toBeCloseTo(viaFlag.resolvedRadiusPx!, 6);
    for (let i = 0; i < 30; i++) {
      expect(viaRatio.beads[i]!.x).toBeCloseTo(viaFlag.beads[i]!.x, 5);
      expect(viaRatio.beads[i]!.y).toBeCloseTo(viaFlag.beads[i]!.y, 5);
    }
  });

  it("supports mixed 4/6/8 mm plus larger charm footprints without inter-bead gaps", () => {
    const diameters = [6, 6, 12, 4, 8, 6, 5, 8, 6, 4];
    const layout = computeBalancedRadialStrandPathLayout({
      ...base,
      beads: diameters.map((diameter, index) => ({
        index,
        occupancyPx: diameter,
        visualRadiusPx: diameter / 2,
      })),
    });
    const order = angularOrderFor(diameters.length);
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i]!.index;
      const b = order[i + 1]!.index;
      expect(
        Math.hypot(
          layout.beads[a]!.x - layout.beads[b]!.x,
          layout.beads[a]!.y - layout.beads[b]!.y,
        ),
      ).toBeCloseTo((diameters[a]! + diameters[b]!) / 2, 3);
    }
    const circumference = 2 * Math.PI * base.radius;
    expect(layout.occupiedArcPx).toBeLessThan(circumference);
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
