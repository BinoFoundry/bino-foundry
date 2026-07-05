import { describe, expect, it } from "vitest";

import {
  adjacentArcSectorsOverlap,
  adjacentIndexAngleDeltaRad,
  computeElasticBeadLayout,
  midpointAngleRad,
  resolveDropTargetFromLayout,
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
      midpointAngleRad(elastic.angles[0]!, elastic.angles[2]!),
      sectors,
      elastic.insertionAngles,
    );
    expect(atGap.mode).toBe("insert");
  });
});
