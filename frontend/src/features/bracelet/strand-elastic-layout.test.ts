import { describe, expect, it } from "vitest";

import {
  adjacentArcSectorsOverlap,
  adjacentIndexAngleDeltaRad,
  computeElasticBeadLayout,
  isSameBeadType,
  midpointAngleRad,
  resolveDropTargetFromLayout,
  resolveLibraryDropTarget,
  resolveLibraryInsertTarget,
} from "./strand-elastic-layout";

describe("computeElasticBeadLayout", () => {
  it("allocates wider arc spans to larger beads", () => {
    const layout = computeElasticBeadLayout([6, 12, 6], 160);
    expect(layout.arcSpans[1]!).toBeGreaterThan(layout.arcSpans[0]!);
    expect(layout.arcSpans[1]!).toBeGreaterThan(layout.arcSpans[2]!);
  });

  it("packs edge-to-edge with zero inter-bead gap when under capacity", () => {
    const sparse = computeElasticBeadLayout([8, 8], 160);
    const dense = computeElasticBeadLayout([8, 8, 8, 8, 8, 8, 8, 8], 160);
    expect(sparse.gapMm).toBe(0);
    expect(dense.gapMm).toBe(0);
  });

  it("does not distribute spare circumference as gaps between neighbours", () => {
    const layout = computeElasticBeadLayout(
      [20, 20],
      200,
      0,
      0,
      { leadingPx: [0, 0], trailingPx: [0, 0] },
    );
    const delta = adjacentIndexAngleDeltaRad(layout.angles, 0);
    const minSep = (layout.arcSpans[0]! + layout.arcSpans[1]!) / 2;
    expect(delta).toBeCloseTo(minSep, 4);
  });

  it("leaves unfinished empty arc only between last and first bead", () => {
    const layout = computeElasticBeadLayout(
      [25, 25, 25],
      200,
      0,
      0,
      { leadingPx: [0, 0, 0], trailingPx: [0, 0, 0] },
    );
    expect(layout.isOverCapacity).toBe(false);
    for (let i = 0; i < 2; i++) {
      const delta = adjacentIndexAngleDeltaRad(layout.angles, i);
      const minSep = (layout.arcSpans[i]! + layout.arcSpans[i + 1]!) / 2;
      expect(delta).toBeCloseTo(minSep, 4);
    }
    const wrap = adjacentIndexAngleDeltaRad(layout.angles, 2);
    const wrapSep = (layout.arcSpans[2]! + layout.arcSpans[0]!) / 2;
    expect(wrap).toBeGreaterThan(wrapSep * 2);
    const emptyFrac = (200 - 75) / 200;
    const expectedWrap =
      layout.arcSpans[2]! / 2 + emptyFrac * 2 * Math.PI + layout.arcSpans[0]! / 2;
    expect(wrap).toBeCloseTo(expectedWrap, 4);
  });

  it("keeps adjacent strand beads from overlapping on a mixed-size strand", () => {
    const layout = computeElasticBeadLayout([6, 10, 8, 12, 6], 160);
    expect(adjacentArcSectorsOverlap(layout.angles, layout.arcSpans)).toBe(false);
    for (let i = 0; i < layout.angles.length; i++) {
      const j = (i + 1) % layout.angles.length;
      const delta = adjacentIndexAngleDeltaRad(layout.angles, i);
      const minSep = (layout.arcSpans[i]! + layout.arcSpans[j]!) / 2;
      expect(delta).toBeGreaterThanOrEqual(minSep * 0.98);
    }
  });

  it("packs proportionally when over wrist capacity", () => {
    const layout = computeElasticBeadLayout([10, 10, 10], 25);
    expect(layout.isOverCapacity).toBe(true);
    expect(layout.gapMm).toBe(0);
    expect(layout.arcSpans[1]!).toBeCloseTo(layout.arcSpans[0]!, 5);
  });
});

describe("computeElasticBeadLayout anchor", () => {
  it("places a lone bead at the custom start angle", () => {
    const anchor = Math.PI / 4;
    const layout = computeElasticBeadLayout([10], 160, anchor);
    expect(layout.angles[0]).toBeCloseTo(anchor, 5);
  });

  it("exposes distinct gap angles on either side of a lone bead", () => {
    const layout = computeElasticBeadLayout([10], 160, 0);
    expect(layout.insertionAngles).toHaveLength(2);
    expect(layout.insertionAngles[0]).not.toBeCloseTo(layout.insertionAngles[1]!, 2);
  });
});

describe("resolveLibraryInsertTarget", () => {
  it("maps each gap to the correct linear insertion index (5-bead acceptance)", () => {
    const elastic = computeElasticBeadLayout([8, 8, 8, 8, 8], 200);
    const gaps = elastic.insertionAngles;

    expect(resolveLibraryInsertTarget(gaps[1]!, gaps).index).toBe(1);
    expect(resolveLibraryInsertTarget(gaps[3]!, gaps).index).toBe(3);
    expect(resolveLibraryInsertTarget(gaps[4]!, gaps).index).toBe(4);
  });

  it("always returns insert mode", () => {
    const elastic = computeElasticBeadLayout([10, 10], 120);
    const atBead = elastic.angles[0]!;
    expect(resolveLibraryInsertTarget(atBead, elastic.insertionAngles)).toEqual({
      mode: "insert",
      index: expect.any(Number),
    });
  });

  it("picks the nearer gap beside a lone bead", () => {
    const elastic = computeElasticBeadLayout([10], 160, 0);
    const [beforeGap, afterGap] = elastic.insertionAngles;
    expect(resolveLibraryInsertTarget(beforeGap!, elastic.insertionAngles).index).toBe(0);
    expect(resolveLibraryInsertTarget(afterGap!, elastic.insertionAngles).index).toBe(1);
  });
});

describe("resolveDropTargetFromLayout", () => {
  it("replaces when library pointer is over bead center", () => {
    const elastic = computeElasticBeadLayout([10, 10], 120);
    const sectors = elastic.angles.map((angle, index) => ({
      index,
      angle,
      arcSpan: elastic.arcSpans[index]!,
    }));
    const atBead = resolveDropTargetFromLayout(elastic.angles[0]!, sectors, elastic.insertionAngles);
    expect(atBead).toEqual({ mode: "replace", index: 0 });
  });

  it("distinguishes replace vs insert using weighted sectors", () => {
    const elastic = computeElasticBeadLayout([10, 10, 10], 120);
    const sectors = elastic.angles.map((angle, index) => ({
      index,
      angle,
      arcSpan: elastic.arcSpans[index]!,
    }));
    const atBead = resolveDropTargetFromLayout(elastic.angles[1]!, sectors, elastic.insertionAngles);
    expect(atBead.mode).toBe("replace");
    expect(atBead.index).toBe(1);

    const atGap = resolveDropTargetFromLayout(
      elastic.insertionAngles[2]!,
      sectors,
      elastic.insertionAngles,
    );
    expect(atGap.mode).toBe("insert");
  });
});

describe("resolveLibraryDropTarget", () => {
  const crystal = { beadTypeId: "type-crystal", beadTypeSlug: "crystal" };
  const charm = { beadTypeId: "type-charm", beadTypeSlug: "charm" };

  function layoutOf(sizes: number[]) {
    const elastic = computeElasticBeadLayout(sizes, 160);
    const sectors = elastic.angles.map((angle, index) => ({
      index,
      angle,
      arcSpan: elastic.arcSpans[index]!,
    }));
    return { elastic, sectors };
  }

  it("replaces when insert_between drag hovers same Type", () => {
    const { elastic, sectors } = layoutOf([8, 8, 10, 8]);
    const placed = [crystal, crystal, charm, crystal];
    const atCharm = resolveLibraryDropTarget({
      pointerAngle: elastic.angles[2]!,
      sectors,
      insertionAngles: elastic.insertionAngles,
      placementMode: "insert_between",
      dragged: charm,
      placedTypeRefs: placed,
    });
    expect(atCharm).toEqual({ mode: "replace", index: 2 });
  });

  it("inserts when insert_between drag is not over same Type", () => {
    const { elastic, sectors } = layoutOf([8, 8, 10, 8]);
    const placed = [crystal, crystal, charm, crystal];
    const atCrystal = resolveLibraryDropTarget({
      pointerAngle: elastic.angles[0]!,
      sectors,
      insertionAngles: elastic.insertionAngles,
      placementMode: "insert_between",
      dragged: charm,
      placedTypeRefs: placed,
    });
    expect(atCrystal.mode).toBe("insert");

    const atGap = resolveLibraryDropTarget({
      pointerAngle: elastic.insertionAngles[2]!,
      sectors,
      insertionAngles: elastic.insertionAngles,
      placementMode: "insert_between",
      dragged: charm,
      placedTypeRefs: placed,
    });
    expect(atGap.mode).toBe("insert");
  });

  it("does not replace across different Types in replace mode", () => {
    const { elastic, sectors } = layoutOf([8, 10, 8]);
    const placed = [crystal, charm, crystal];
    const atCharm = resolveLibraryDropTarget({
      pointerAngle: elastic.angles[1]!,
      sectors,
      insertionAngles: elastic.insertionAngles,
      placementMode: "replace",
      dragged: crystal,
      placedTypeRefs: placed,
    });
    expect(atCharm.mode).toBe("insert");
  });

  it("replaces same Type in replace mode", () => {
    const { elastic, sectors } = layoutOf([8, 8, 8]);
    const placed = [crystal, crystal, crystal];
    const atBead = resolveLibraryDropTarget({
      pointerAngle: elastic.angles[1]!,
      sectors,
      insertionAngles: elastic.insertionAngles,
      placementMode: "replace",
      dragged: crystal,
      placedTypeRefs: placed,
    });
    expect(atBead).toEqual({ mode: "replace", index: 1 });
  });

  it("matches Type by id only (Sub-Type ignored)", () => {
    expect(isSameBeadType({ beadTypeId: "type-charm" }, { beadTypeId: "type-charm" })).toBe(true);
    expect(isSameBeadType({ beadTypeId: "type-charm" }, { beadTypeId: "type-crystal" })).toBe(false);
  });
});
