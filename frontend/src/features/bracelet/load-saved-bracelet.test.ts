import { describe, expect, it } from "vitest";

import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadAvailabilityStatus } from "@/types/bead-availability";

import { buildPlacedFromSavedBracelet } from "./load-saved-bracelet";
import { isUnavailablePlacedBead } from "./unavailable-bead";
import { sizesForLibrary, isSizeAvailableForNew } from "./library-sizes";

function bead(id: string): BeadLibraryEntry {
  return {
    id,
    name: "Crystal Rose",
    image: "/rose.png",
    beadTypeId: "t1",
    beadTypeSlug: "crystal",
    description: "",
    availabilityStatusCode: "ACTIVE",
    isActive: true,
  };
}

function offer(
  libraryId: string,
  sizeMm: number,
  availableForNew = true,
): BeadLibrarySizeOffer {
  return {
    id: `${libraryId}-${sizeMm}`,
    beadLibraryId: libraryId,
    beadSizeId: `size-${sizeMm}`,
    sizeMm,
    label: `${sizeMm} mm`,
    unitPrice: 12,
    offerKey: `${libraryId}-${sizeMm}`,
    availableForNew,
  };
}

const activeStatus: BeadAvailabilityStatus = {
  code: "ACTIVE",
  label: "Active",
  description: "",
  showInBuilder: true,
  allowNewDesigns: true,
  displayOrder: 0,
};

describe("buildPlacedFromSavedBracelet unavailable sizes", () => {
  const wristSizes = [{ id: "w1", sizeCm: 16, label: "16", isActive: true, displayOrder: 0 }];

  it("loads designs with soft-disabled sizes and marks them unavailable", () => {
    const libraries = [bead("rose")];
    const sizes = [offer("rose", 8, false)];
    const result = buildPlacedFromSavedBracelet(
      {
        twinning: false,
        wristSizeCmA: 16,
        wristSizeCmB: 16,
        items: [
          {
            strandIndex: 0,
            slotPosition: 0,
            beadLibraryId: "rose",
            beadSizeMm: 8,
          },
        ],
      },
      libraries,
      sizes,
      wristSizes,
      [activeStatus],
    );

    expect(result.placedBeadsA).toHaveLength(1);
    expect(isUnavailablePlacedBead(result.placedBeadsA[0]!)).toBe(true);
    expect(result.placedBeadsA[0]!.bead.name).toBe("Crystal Rose");
    expect(result.placedBeadsA[0]!.bead.metadata?.catalogIssue).toBe("unavailable");
    expect(result.placedBeadsA[0]!.size.sizeMm).toBe(8);
  });

  it("keeps available sizes selectable without catalog issues", () => {
    const libraries = [bead("rose")];
    const sizes = [offer("rose", 8, true)];
    const result = buildPlacedFromSavedBracelet(
      {
        twinning: false,
        wristSizeCmA: 16,
        wristSizeCmB: 16,
        items: [
          {
            strandIndex: 0,
            slotPosition: 0,
            beadLibraryId: "rose",
            beadSizeMm: 8,
          },
        ],
      },
      libraries,
      sizes,
      wristSizes,
      [activeStatus],
    );

    expect(isUnavailablePlacedBead(result.placedBeadsA[0]!)).toBe(false);
  });
});

describe("sizesForLibrary availability filter", () => {
  it("hides soft-disabled sizes from new selections by default", () => {
    const offers = [offer("rose", 6, true), offer("rose", 8, false)];
    expect(sizesForLibrary(offers, "rose").map((o) => o.sizeMm)).toEqual([6]);
    expect(isSizeAvailableForNew(offers[1]!)).toBe(false);
  });

  it("includes soft-disabled sizes when includeUnavailable is set", () => {
    const offers = [offer("rose", 8, false)];
    expect(sizesForLibrary(offers, "rose", { includeUnavailable: true })).toHaveLength(1);
  });
});
