import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { wristCircumferenceMm } from "./capacity";
import { isMatchingPairMatched, resolveAutoPlacementStrand } from "./matching-pair-placement";

function bead(sizeMm: number): PlacedBead {
  return {
    position: 0,
    bead: { id: "b", name: "B", image: "", beadTypeId: "", description: "" },
    size: {
      id: "s",
      offerKey: "s",
      beadLibraryId: "b",
      beadSizeId: "sz",
      sizeMm,
      label: `${sizeMm} mm`,
      unitPrice: 1,
    },
  };
}

function fillStrand(wristCm: number, beadMm: number): PlacedBead[] {
  const count = Math.floor(wristCircumferenceMm(wristCm) / beadMm);
  return Array.from({ length: count }, (_, i) => ({ ...bead(beadMm), position: i }));
}

describe("resolveAutoPlacementStrand", () => {
  it("uses strand A when not twinning", () => {
    expect(
      resolveAutoPlacementStrand({
        twinning: false,
        wristSizeA: 16,
        wristSizeB: 16,
        placedA: [],
        placedB: [],
        beadSizeMm: 8,
      }),
    ).toBe("A");
  });

  it("continues on strand B when A is full in matching pair mode", () => {
    const wrist = 16;
    const placedA = fillStrand(wrist, 8);
    expect(
      resolveAutoPlacementStrand({
        twinning: true,
        wristSizeA: wrist,
        wristSizeB: wrist,
        placedA,
        placedB: [],
        beadSizeMm: 8,
      }),
    ).toBe("B");
  });

  it("returns null when both strands are full", () => {
    const wrist = 16;
    const full = fillStrand(wrist, 8);
    expect(
      resolveAutoPlacementStrand({
        twinning: true,
        wristSizeA: wrist,
        wristSizeB: wrist,
        placedA: full,
        placedB: full,
        beadSizeMm: 8,
      }),
    ).toBeNull();
  });
});

describe("isMatchingPairMatched", () => {
  it("is true when bracelet B has beads", () => {
    expect(isMatchingPairMatched([bead(8)])).toBe(true);
  });

  it("is false when bracelet B is empty", () => {
    expect(isMatchingPairMatched([])).toBe(false);
  });
});
