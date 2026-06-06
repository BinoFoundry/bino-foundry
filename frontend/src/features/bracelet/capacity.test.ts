import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  buildStrandFitMetrics,
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

describe("wrist-target capacity", () => {
  it("sums placed bead mm against wrist target", () => {
    const placed = [bead(0, 6), bead(1, 8), bead(2, 4)];
    expect(strandUsedMm(placed)).toBe(18);
    expect(strandRemainingMm(16, placed)).toBe(142);
  });

  it("blocks placement when bead exceeds remaining target space", () => {
    const placed = Array.from({ length: 16 }, (_, i) => bead(i, 10));
    expect(strandRemainingMm(16, placed)).toBe(0);
    expect(canPlaceBeadSize(16, placed, 8)).toBe(false);
    expect(canPlaceBeadSize(16, [bead(0, 10)], 8)).toBe(true);
  });

  it("reports capacity percent and over-capacity state", () => {
    const placed = [bead(0, 80), bead(1, 90)];
    const metrics = buildStrandFitMetrics(16, placed);
    expect(metrics.capacityPercent).toBeGreaterThan(100);
    expect(metrics.isOverCapacity).toBe(true);
    expect(metrics.overCapacityMm).toBeGreaterThan(0);
    expect(metrics.remainingMm).toBeLessThan(0);
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
