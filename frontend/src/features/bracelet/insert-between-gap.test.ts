import { describe, expect, it } from "vitest";

import { insertBeadAt } from "./composition";
import {
  computeBalancedRadialStrandPathLayout,
  STRAND_PATH_START_ANGLE,
} from "./strand-path";
import { resolveLibraryInsertTarget } from "./strand-elastic-layout";
import type { PlacedBead } from "@/lib/luxe-data";

function mockPlaced(id: number, position: number): PlacedBead {
  return {
    position,
    bead: {
      id: `b-${id}`,
      name: `Bead ${id}`,
      image: "",
      beadTypeId: "type-crystal",
      beadTypeSlug: "crystal",
      description: "",
    },
    size: {
      id: `s-${id}`,
      beadLibraryId: `b-${id}`,
      sizeMm: 8,
      label: "8",
      unitPrice: 1,
    },
  };
}

describe("balanced layout insert_between gap indices", () => {
  it("maps each inter-bead gap to the insertBeadAt index (no off-by-one)", () => {
    const beads = [0, 1, 2].map((i) => ({ index: i, occupancyPx: 40 }));
    const layout = computeBalancedRadialStrandPathLayout({
      beads,
      centerX: 200,
      centerY: 200,
      radius: 100,
      startAngle: STRAND_PATH_START_ANGLE,
    });

    // insertionAngles[i] → insert at i (closure duplicated at 0 and n)
    expect(layout.insertionAngles).toHaveLength(4);
    expect(resolveLibraryInsertTarget(layout.insertionAngles[0]!, layout.insertionAngles).index).toBe(0);
    expect(resolveLibraryInsertTarget(layout.insertionAngles[1]!, layout.insertionAngles).index).toBe(1);
    expect(resolveLibraryInsertTarget(layout.insertionAngles[2]!, layout.insertionAngles).index).toBe(2);
    expect(resolveLibraryInsertTarget(layout.insertionAngles[3]!, layout.insertionAngles).index).toBe(0);
  });

  it("inserting at gap between bead 1 and bead 2 places the new item between them", () => {
    const beads = [0, 1, 2].map((i) => ({ index: i, occupancyPx: 40 }));
    const layout = computeBalancedRadialStrandPathLayout({
      beads,
      centerX: 200,
      centerY: 200,
      radius: 100,
      startAngle: STRAND_PATH_START_ANGLE,
    });

    // Gap before bead 1 (= between bead 0 and bead 1) is insertionAngles[1]
    const target = resolveLibraryInsertTarget(
      layout.insertionAngles[1]!,
      layout.insertionAngles,
    );
    expect(target).toEqual({ mode: "insert", index: 1 });

    const placed = [mockPlaced(1, 0), mockPlaced(2, 1), mockPlaced(3, 2)];
    const next = insertBeadAt(placed, target.index, mockPlaced(99, 0));
    expect(next.map((p) => p.bead.id)).toEqual(["b-1", "b-99", "b-2", "b-3"]);
  });

  it("nearest-gap detection does not derive insert index from bead index + offset", () => {
    const beads = [0, 1, 2, 3, 4].map((i) => ({ index: i, occupancyPx: 30 }));
    const layout = computeBalancedRadialStrandPathLayout({
      beads,
      centerX: 200,
      centerY: 200,
      radius: 120,
      startAngle: STRAND_PATH_START_ANGLE,
    });
    for (let i = 1; i < beads.length; i++) {
      expect(
        resolveLibraryInsertTarget(layout.insertionAngles[i]!, layout.insertionAngles).index,
      ).toBe(i);
    }
  });
});
