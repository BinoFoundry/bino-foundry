import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  EMPTY_GUIDE_SLOT_COUNT,
  findBestInsertIndex,
  insertBeadWithAutoLayout,
  strandCircumferenceMm,
  strandDisplaySlotCount,
} from "./composition";

function bead(position: number, mm: number): PlacedBead {
  const lib: BeadLibraryEntry = {
    id: `b-${position}-${mm}`,
    name: "Test",
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
    offerKey: `${lib.id}-${mm}`,
  };
  return { position, bead: lib, size: s };
}

describe("strandDisplaySlotCount", () => {
  it("shows one add affordance when empty", () => {
    expect(strandDisplaySlotCount([])).toBe(1);
  });

  it("adds one insertion slot when beads exist", () => {
    expect(strandDisplaySlotCount([bead(0, 8)])).toBe(2);
    expect(strandDisplaySlotCount([bead(0, 8), bead(1, 10)])).toBe(3);
  });
});

describe("strandCircumferenceMm", () => {
  it("uses composition length when beads exist", () => {
    expect(strandCircumferenceMm([bead(0, 6), bead(1, 8)], 8)).toBe(14);
  });

  it("uses guide baseline when empty", () => {
    expect(strandCircumferenceMm([], 8)).toBe(EMPTY_GUIDE_SLOT_COUNT * 8);
  });
});

describe("auto layout", () => {
  it("places first bead at index 0", () => {
    expect(findBestInsertIndex([], 8)).toBe(0);
    const next = insertBeadWithAutoLayout([], bead(99, 8));
    expect(next).toHaveLength(1);
    expect(next[0].position).toBe(0);
  });

  it("places second bead opposite first", () => {
    const one = [bead(0, 8)];
    expect(findBestInsertIndex(one, 8)).toBe(1);
    const two = insertBeadWithAutoLayout(one, bead(99, 8));
    expect(two.map((b) => b.position)).toEqual([0, 1]);
  });

  it("respects mixed mm when picking gap", () => {
    const placed = [bead(0, 12), bead(1, 4)];
    const idx = findBestInsertIndex(placed, 8);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(2);
  });
});
