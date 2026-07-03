import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import { getBeadImageUrl, getStrandBeadImageStyle } from "./strand-bead";
import { resolveBeadSlotSizing } from "./strand-bead-sizing";
import { layoutDiameterPxForMm } from "./canonical-strand-mm-scale";

const GROUP_REF = 765;
const PROCESSED_URL = "https://example.com/p.png";

function placedBead(): PlacedBead {
  return {
    position: 0,
    size: {
      offerKey: "aqua-6",
      sizeMm: 6,
      label: "6 mm",
      unitPrice: 1,
      normalizedProcessedImageUrl: "https://example.supabase.co/storage/v1/object/public/assets/bead-normalized.webp",
      normalizedVisibleDiameterPx: GROUP_REF,
      normalizedDeliveryUrls: { webp: "https://example.supabase.co/storage/v1/object/public/assets/bead-normalized.webp" },
      groupReferenceDiameterPx: GROUP_REF,
    },
    bead: {
      id: "aquamarine",
      name: "Aquamarine",
      beadTypeId: "crystal",
      beadTypeSlug: "crystal",
      image: PROCESSED_URL,
      processedImage: PROCESSED_URL,
      description: "",
      cropConfig: {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 1000,
        imageHeight: 1000,
        originalUrl: "https://example.com/o.png",
        points: [],
        scale: 1,
      },
    },
  };
}

describe("strand canonical asset rendering", () => {
  it("uses one canonical processed asset at runtime (mm scaling via layout slot)", () => {
    const url = getBeadImageUrl(placedBead(), {
      beadSizes: [{ id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: GROUP_REF }],
      beadLibrarySizes: [],
    });
    expect(url).toContain(PROCESSED_URL);
    expect(url).not.toContain("/render/image/");
    expect(url).not.toContain("bead-normalized.webp");
  });

  it("sizes the mm wrapper from configured diameter and scales image uniformly", () => {
    const bead = placedBead();
    const sizing = resolveBeadSlotSizing(bead, 6, 1, {
      beadSizes: [{ id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: GROUP_REF }],
    });
    expect(sizing.configuredSizeMm).toBe(6);
    expect(sizing.dimensions.width).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(sizing.usesClipPath).toBe(false);

    const eight = resolveBeadSlotSizing(bead, 8, 1, {
      beadSizes: [{ id: "s8", sizeMm: 8, label: "8 mm", groupReferenceDiameterPx: GROUP_REF }],
    });
    expect(eight.dimensions.width).toBeGreaterThan(sizing.dimensions.width);

    const style = getStrandBeadImageStyle(bead.bead, sizing);
    expect(style.objectFit).toBeUndefined();
    expect(style.width).toBe(sizing.imageDimensions.width);
    expect(style.height).toBe(sizing.imageDimensions.height);
    expect(style.position).toBe("absolute");
  });
});
