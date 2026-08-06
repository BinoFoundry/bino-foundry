import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { normalizeFromSlots, needsSparseSlotMigration } from "./composition";
import { remapIndexAfterMove } from "./placement-instance";

function bead(id: string, position: number, instanceId: string): PlacedBead {
  return {
    position,
    instanceId,
    bead: {
      id,
      name: id,
      image: "",
      beadTypeId: "t",
      description: "",
    },
    size: {
      id: `v-${id}`,
      beadLibraryId: id,
      beadSizeId: `s-${id}`,
      sizeMm: 8,
      unitPrice: 8,
      label: "8 mm",
      offerKey: `${id}-8`,
    },
  };
}

describe("normalizeFromSlots", () => {
  it("preserves array order when positions are dense but out of sync with indices", () => {
    const placed = [
      bead("A", 0, "i-a"),
      bead("B", 2, "i-b"),
      bead("C", 1, "i-c"),
    ];
    expect(needsSparseSlotMigration(placed)).toBe(false);
    const dense = normalizeFromSlots(placed);
    expect(dense.map((b) => b.bead.id)).toEqual(["A", "B", "C"]);
    expect(dense.map((b) => b.position)).toEqual([0, 1, 2]);
  });

  it("migrates legacy sparse slot positions by sorting once", () => {
    const placed = [bead("A", 0, "i-a"), bead("C", 2, "i-c")];
    expect(needsSparseSlotMigration(placed)).toBe(true);
    const dense = normalizeFromSlots(placed);
    expect(dense.map((b) => b.bead.id)).toEqual(["A", "C"]);
  });
});

describe("remapIndexAfterMove", () => {
  it("remaps selection when another bead is moved", () => {
    expect(remapIndexAfterMove(3, 1, 4)).toBe(2);
    expect(remapIndexAfterMove(1, 1, 4)).toBe(4);
    expect(remapIndexAfterMove(2, 4, 1)).toBe(3);
  });
});
