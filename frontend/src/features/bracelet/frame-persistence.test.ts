import { describe, expect, it } from "vitest";

import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadAvailabilityStatus } from "@/types/bead-availability";
import type { PlacedBead } from "@/lib/luxe-data";

import { removeBeadFrame } from "./composition";
import { buildPlacedFromSavedBracelet } from "./load-saved-bracelet";
import { buildPlacedFromOrderBracelet } from "./load-order-bracelet";
import { buildBraceletPricing } from "./pricing";
import { serializeBraceletConfiguration } from "./serialize";

function bead(id: string, name: string, typeSlug: string): BeadLibraryEntry {
  return {
    id,
    name,
    image: `/${id}.png`,
    beadTypeId: `type-${typeSlug}`,
    beadTypeSlug: typeSlug,
    description: "",
    availabilityStatusCode: "ACTIVE",
    isActive: true,
  };
}

function offer(libraryId: string, sizeMm: number, unitPrice: number): BeadLibrarySizeOffer {
  return {
    id: `${libraryId}-${sizeMm}`,
    beadLibraryId: libraryId,
    beadSizeId: `size-${sizeMm}`,
    sizeMm,
    label: `${sizeMm} mm`,
    unitPrice,
    offerKey: `${libraryId}-${sizeMm}`,
    availableForNew: true,
  };
}

const crystal = bead("rose", "Crystal Rose", "crystal");
const halo = bead("gold-halo", "Gold Halo", "spacer");
const crystalOffer = offer("rose", 8, 12);
const haloOffer = offer("gold-halo", 10, 8);

const libraries = [crystal, halo];
const sizes = [crystalOffer, haloOffer];
const wristSizes = [{ id: "w1", sizeCm: 16, label: "16", isActive: true, displayOrder: 0 }];
const activeStatus: BeadAvailabilityStatus = {
  code: "ACTIVE",
  label: "Active",
  description: "",
  showInBuilder: true,
  allowNewDesigns: true,
  displayOrder: 0,
};

const framedBead: PlacedBead = {
  position: 0,
  bead: crystal,
  size: crystalOffer,
  frame: { bead: halo, size: haloOffer },
};
const plainBead: PlacedBead = { position: 1, bead: crystal, size: crystalOffer };

const pricing = buildBraceletPricing(
  [framedBead, plainBead],
  [],
  false,
  16,
  16,
  [],
  "SGD",
  sizes,
);

describe("frame persistence", () => {
  it("writes the frame onto the bead it wraps, not as its own slot", () => {
    const payload = serializeBraceletConfiguration(
      [framedBead, plainBead],
      [],
      false,
      16,
      16,
      pricing,
    );

    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].frame).toEqual({ beadLibraryId: "gold-halo", beadSizeMm: 10 });
    expect(payload.items[0].slotPosition).toBe(0);
    // The bead beside it is untouched — a frame never leaks onto its neighbours.
    expect(payload.items[1].frame).toBeUndefined();
  });

  it("restores the frame when the design is reopened", () => {
    const loaded = buildPlacedFromSavedBracelet(
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
            frame: { beadLibraryId: "gold-halo", beadSizeMm: 10 },
          },
        ],
      },
      libraries,
      sizes,
      wristSizes,
      [activeStatus],
    );

    expect(loaded.placedBeadsA[0].frame?.bead.id).toBe("gold-halo");
    expect(loaded.placedBeadsA[0].frame?.size.sizeMm).toBe(10);
  });

  it("keeps the bead when the frame has left the catalogue", () => {
    const loaded = buildPlacedFromSavedBracelet(
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
            frame: { beadLibraryId: "discontinued", beadSizeMm: 10 },
          },
        ],
      },
      libraries,
      sizes,
      wristSizes,
      [activeStatus],
    );

    expect(loaded.placedBeadsA).toHaveLength(1);
    expect(loaded.placedBeadsA[0].bead.id).toBe("rose");
    expect(loaded.placedBeadsA[0].frame).toBeUndefined();
    expect(loaded.unavailableCount).toBe(0);
  });

  it("bills the frame as its own line without adding a slot", () => {
    const frameLine = pricing.lineItems.find((i) => i.beadLibraryId === "gold-halo");
    expect(frameLine?.quantity).toBe(1);
    expect(frameLine?.lineTotal).toBe(8);
    expect(pricing.subtotal).toBe(12 + 12 + 8);
    // Two beads on the strand; the halo shares a slot rather than taking one.
    expect(pricing.placedCount).toBe(2);
  });

  it("takes the halo off without disturbing the bead or its neighbours", () => {
    const strand = [framedBead, plainBead];
    const next = removeBeadFrame(strand, 0);

    expect(next[0].frame).toBeUndefined();
    expect(next[0].bead.id).toBe("rose");
    expect(next[0].position).toBe(0);
    expect(next).toHaveLength(2);
    expect(next[1].bead.id).toBe("rose");
    // The original array is untouched — the strand is replaced, not mutated.
    expect(strand[0].frame?.bead.id).toBe("gold-halo");
  });

  it("leaves the strand alone when there is no halo to remove", () => {
    const strand = [framedBead, plainBead];
    expect(removeBeadFrame(strand, 1)).toBe(strand);
    expect(removeBeadFrame(strand, 9)).toBe(strand);
  });

  it("replays a frozen order without the live catalogue", () => {
    const result = buildPlacedFromOrderBracelet({
      twinning: false,
      wristSizeCmA: 16,
      wristSizeCmB: 16,
      preparation: null,
      beadSubtotal: 20,
      preparationSubtotal: 0,
      items: [
        {
          strandIndex: 0,
          slotPosition: 0,
          beadLibraryId: "rose",
          beadName: "Crystal Rose",
          beadSizeMm: 8,
          sizeLabel: "8 mm",
          unitPrice: 12,
          render: { image: "/rose.png", offerKey: "rose-8" },
          frame: {
            beadLibraryId: "gold-halo",
            beadName: "Gold Halo",
            beadSizeMm: 10,
            sizeLabel: "10 mm",
            unitPrice: 8,
            render: { image: "/gold-halo.png", offerKey: "gold-halo-10" },
          },
        },
      ],
    });

    expect(result.usedFrozenRender).toBe(true);
    expect(result.placedBeadsA[0].frame?.bead.name).toBe("Gold Halo");
    expect(result.placedBeadsA[0].frame?.bead.image).toBe("/gold-halo.png");
    expect(result.placedBeadsA[0].frame?.size.unitPrice).toBe(8);
  });
});
