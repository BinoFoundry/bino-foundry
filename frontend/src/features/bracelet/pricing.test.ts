import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";

import { buildBraceletPricing, calculateUnitPrice, sizeMultiplierForMm } from "./pricing";

function bead(overrides: Partial<BeadLibraryEntry> = {}): BeadLibraryEntry {
  return {
    id: "b1",
    name: "Rose Quartz",
    price: 10,
    image: "",
    beadTypeId: "t1",
    beadTypeSlug: "crystal",
    description: "",
    ...overrides,
  };
}

function placed(b: BeadLibraryEntry, mm = 8): PlacedBead {
  return { position: 0, bead: b, beadSize: mm };
}

const beadTypes: BeadTypeEntry[] = [
  { id: "t1", slug: "crystal", name: "Crystal", description: "", usesSizePricing: true },
  { id: "t2", slug: "charm", name: "Charm", description: "", usesSizePricing: false },
];

const beadSizes: BeadSizeEntry[] = [
  { id: "s6", sizeMm: 6, label: "6 mm", priceMultiplier: 0.8, isActive: true },
  { id: "s8", sizeMm: 8, label: "8 mm", priceMultiplier: 1, isActive: true },
  { id: "s10", sizeMm: 10, label: "10 mm", priceMultiplier: 1.3, isActive: true },
];

describe("sizeMultiplierForMm", () => {
  it("reads multiplier from bead_sizes", () => {
    expect(sizeMultiplierForMm(10, beadSizes)).toBe(1.3);
  });
});

describe("calculateUnitPrice", () => {
  it("applies size multiplier for size-priced types", () => {
    expect(calculateUnitPrice(bead(), 10, beadTypes, beadSizes)).toBe(13);
  });

  it("uses flat price for charms", () => {
    expect(calculateUnitPrice(bead({ beadTypeSlug: "charm", price: 25 }), 10, beadTypes, beadSizes)).toBe(25);
  });
});

describe("buildBraceletPricing", () => {
  it("aggregates placed beads and capacity", () => {
    const pricing = buildBraceletPricing(
      [placed(bead()), { ...placed(bead({ id: "b2", name: "Amethyst" })), position: 1 }],
      [],
      false,
      16,
      16,
      8,
      "USD",
      beadTypes,
      beadSizes,
    );
    expect(pricing.placedCount).toBe(2);
    expect(pricing.capacityCount).toBe(20);
    expect(pricing.total).toBe(20);
  });
});
