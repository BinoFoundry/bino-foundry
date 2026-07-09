import { describe, expect, it } from "vitest";

import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import { buildBraceletPricing, formatPricingLineItemLabel } from "./pricing";
import type { PlacedBead } from "@/lib/luxe-data";

const b: BeadLibraryEntry = {
  id: "crystal-1",
  name: "Amethyst",
  image: "",
  beadTypeId: "t1",
  beadTypeSlug: "crystal",
  description: "",
};

function offer(overrides: Partial<BeadLibrarySizeOffer> = {}): BeadLibrarySizeOffer {
  const sizeMm = overrides.sizeMm ?? 8;
  return {
    id: "o1",
    beadLibraryId: "crystal-1",
    beadSizeId: "s1",
    sizeMm,
    label: `${sizeMm} mm`,
    unitPrice: 10,
    offerKey: `crystal-1-${sizeMm}`,
    ...overrides,
  };
}

function placed(size: BeadLibrarySizeOffer, pos = 0): PlacedBead {
  return { position: pos, bead: b, size };
}

const librarySizes: BeadLibrarySizeOffer[] = [
  offer({ sizeMm: 6, unitPrice: 10, offerKey: "crystal-1-6" }),
  offer({ sizeMm: 8, unitPrice: 14, offerKey: "crystal-1-8" }),
];

describe("formatPricingLineItemLabel", () => {
  it("includes bead name and size", () => {
    expect(
      formatPricingLineItemLabel({
        beadName: "Tiger Eye",
        sizeLabel: "6 mm",
        beadSizeMm: 6,
        quantity: 1,
      }),
    ).toBe("Tiger Eye (6 mm)");
  });

  it("appends quantity when greater than one", () => {
    expect(
      formatPricingLineItemLabel({
        beadName: "Amethyst",
        sizeLabel: "8 mm",
        beadSizeMm: 8,
        quantity: 6,
      }),
    ).toBe("Amethyst (8 mm) × 6");
  });

  it("falls back to beadSizeMm when size label is empty", () => {
    expect(
      formatPricingLineItemLabel({
        beadName: "Black Obsidian",
        sizeLabel: "",
        beadSizeMm: 10,
        quantity: 2,
      }),
    ).toBe("Black Obsidian (10 mm) × 2");
  });
});

describe("buildBraceletPricing", () => {
  it("sums variant unit prices", () => {
    const p = buildBraceletPricing(
      [placed(offer({ sizeMm: 6, unitPrice: 10, offerKey: "crystal-1-6" })), placed(offer({ sizeMm: 8, unitPrice: 14, offerKey: "crystal-1-8" }), 1)],
      [],
      false,
      16,
      16,
      [],
      "USD",
      librarySizes,
    );
    expect(p.total).toBe(24);
    expect(p.placedCount).toBe(2);
  });
});
