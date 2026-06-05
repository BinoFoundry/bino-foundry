import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { movePlacedBead } from "./sequence-reorder";

function item(pos: number): PlacedBead {
  return {
    position: pos,
    bead: {
      id: `b${pos}`,
      name: `Bead ${pos}`,
      price: 1,
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

describe("movePlacedBead", () => {
  it("moves bead to trailing insertion slot", () => {
    const placed = [item(0), item(1)];
    const next = movePlacedBead(placed, 0, 2);
    expect(next.map((b) => b.bead.id)).toEqual(["b1", "b0"]);
  });

  it("reorders between occupied positions", () => {
    const placed = [item(0), item(1), item(2)];
    const next = movePlacedBead(placed, 0, 1);
    expect(next.map((b) => b.bead.id)).toEqual(["b1", "b0", "b2"]);
  });
});
