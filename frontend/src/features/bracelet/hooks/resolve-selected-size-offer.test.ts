import { describe, expect, it } from "vitest";

import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import { resolveSelectedSizeOfferKey } from "../library-sizes";

function offer(
  beadLibraryId: string,
  sizeMm: number,
  opts?: { isDefault?: boolean },
): BeadLibrarySizeOffer {
  return {
    id: `${beadLibraryId}-${sizeMm}`,
    beadLibraryId,
    beadSizeId: `size-${sizeMm}`,
    sizeMm,
    label: `${sizeMm}mm`,
    unitPrice: sizeMm,
    offerKey: `${beadLibraryId}-${sizeMm}`,
    isDefault: opts?.isDefault,
  };
}

describe("resolveSelectedSizeOfferKey", () => {
  const offers = [
    offer("amethyst", 6, { isDefault: true }),
    offer("amethyst", 8),
    offer("amethyst", 10),
    offer("rose", 6, { isDefault: true }),
    offer("rose", 8),
  ];

  it("keeps a non-default size chosen from the mobile size filter", () => {
    expect(resolveSelectedSizeOfferKey(offers, "amethyst", "amethyst-8")).toBe("amethyst-8");
  });

  it("falls back to the default size when nothing is selected", () => {
    expect(resolveSelectedSizeOfferKey(offers, "amethyst", null)).toBe("amethyst-6");
  });

  it("falls back to the default when the key belongs to another bead", () => {
    expect(resolveSelectedSizeOfferKey(offers, "amethyst", "rose-8")).toBe("amethyst-6");
  });
});
