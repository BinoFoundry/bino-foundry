import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  canPlaceBeadSize,
  prunePlacedBeads,
  strandRemainingMm,
  strandUsedMm,
  wristCircumferenceMm,
} from "./capacity";

function bead(position: number, mm: number): PlacedBead {
  const lib: BeadLibraryEntry = {
    id: `b-${position}`,
    name: "Test",
    price: 1,
    image: "",
    beadTypeId: "t1",
    beadTypeSlug: "crystal",
    description: "",
  };
  const s: BeadLibrarySizeOffer = {
    id: `v-${mm}`,
    beadLibraryId: lib.id,
    beadSizeId: `s-${mm}`,
    sizeMm: mm,
    unitPrice: mm,
    label: `${mm} mm`,
    offerKey: `b-${position}-${mm}`,
  };
  return { position, bead: lib, size: s };
}

describe("wrist fit (advisory)", () => {
  it("sums variant mm for composition length", () => {
    const placed = [bead(0, 6), bead(1, 8), bead(2, 4)];
    expect(strandUsedMm(placed)).toBe(18);
    expect(strandRemainingMm(16, placed)).toBe(142);
  });

  it("never blocks placement by wrist or slot count", () => {
    const placed = [bead(0, 10), bead(1, 10)];
    expect(canPlaceBeadSize(14, placed, 40)).toBe(true);
  });
});

describe("prunePlacedBeads", () => {
  it("normalizes sequence without removing beads", () => {
    const placed = [bead(2, 8), bead(0, 6), bead(1, 4)];
    const next = prunePlacedBeads(placed);
    expect(next.map((b) => b.position)).toEqual([0, 1, 2]);
    expect(strandUsedMm(next)).toBe(18);
    expect(strandUsedMm(next)).toBeLessThanOrEqual(wristCircumferenceMm(14) + 100);
  });
});
