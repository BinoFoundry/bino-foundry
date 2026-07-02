import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { swapPlacedBeads } from "./sequence-reorder";

function item(pos: number): PlacedBead {
  return {
    position: pos,
    bead: {
      id: `b${pos}`,
      name: `Bead ${pos}`,
      image: "",
      beadTypeId: "t",
      description: "",
    },
    size: {
      id: `v${pos}`,
      beadLibraryId: `b${pos}`,
      beadSizeId: `s${pos}`,
      sizeMm: 8,
      unitPrice: 8,
      label: "8 mm",
      offerKey: `b${pos}-8`,
    },
  };
}

describe("swapPlacedBeads", () => {
  it("swaps two beads without shifting the rest", () => {
    const placed = [item(0), item(1), item(2), item(3), item(4), item(5), item(6)];
    const next = swapPlacedBeads(placed, 2, 5);
    expect(next.map((b) => b.bead.id)).toEqual([
      "b0",
      "b1",
      "b5",
      "b3",
      "b4",
      "b2",
      "b6",
    ]);
  });

  it("leaves the sequence unchanged when swapping onto the same index", () => {
    const placed = [item(0), item(1), item(2)];
    const next = swapPlacedBeads(placed, 1, 1);
    expect(next.map((b) => b.bead.id)).toEqual(["b0", "b1", "b2"]);
  });

  it("swaps adjacent beads", () => {
    const placed = [item(0), item(1), item(2)];
    const next = swapPlacedBeads(placed, 0, 1);
    expect(next.map((b) => b.bead.id)).toEqual(["b1", "b0", "b2"]);
  });
});
