import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { countPrunedBeads, prunePlacedBeads, strandCapacity } from "./capacity";

function bead(position: number): PlacedBead {
  return {
    position,
    beadSize: 8,
    bead: {
      id: `b-${position}`,
      name: "Test",
      price: 1,
      image: "",
      beadTypeId: "t1",
      beadTypeSlug: "crystal",
      description: "",
    },
  };
}

describe("strandCapacity", () => {
  it("scales inversely with bead mm for the same wrist", () => {
    const wrist = 16;
    expect(strandCapacity(wrist, 6)).toBeGreaterThan(strandCapacity(wrist, 10));
  });

  it("increases when wrist grows at fixed mm", () => {
    expect(strandCapacity(18, 8)).toBeGreaterThan(strandCapacity(16, 8));
  });

  it("matches product formula round((wrist*10)/mm) with min 8", () => {
    expect(strandCapacity(16, 8)).toBe(20);
    expect(strandCapacity(16, 10)).toBe(16);
    expect(strandCapacity(14, 10)).toBe(14);
    expect(strandCapacity(10, 12)).toBe(8);
  });
});

describe("prunePlacedBeads", () => {
  it("drops beads outside new capacity and keeps order", () => {
    const placed = [bead(0), bead(5), bead(19), bead(25)];
    const next = prunePlacedBeads(placed, 20);
    expect(next.map((b) => b.position)).toEqual([0, 5, 19]);
  });

  it("reports prune count", () => {
    const placed = [bead(0), bead(21), bead(22)];
    expect(countPrunedBeads(placed, 20)).toBe(2);
    expect(countPrunedBeads(placed, 25)).toBe(0);
  });
});
