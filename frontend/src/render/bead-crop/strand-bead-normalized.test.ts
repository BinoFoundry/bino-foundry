import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import { getBeadImageUrl, getStrandBeadImageStyle } from "./strand-bead";
import { resolveBeadSlotSizing } from "./strand-bead-sizing";

const GROUP_REF = 765;
const NORMALIZED_URL =
  "https://example.supabase.co/storage/v1/object/public/assets/bead-normalized.webp";

function placedBead(): PlacedBead {
  return {
    position: 0,
    size: {
      offerKey: "aqua-6",
      sizeMm: 6,
      label: "6 mm",
      unitPrice: 1,
      normalizedProcessedImageUrl: NORMALIZED_URL,
      normalizedVisibleDiameterPx: GROUP_REF,
      normalizedDeliveryUrls: { webp: NORMALIZED_URL },
      groupReferenceDiameterPx: GROUP_REF,
    },
    bead: {
      id: "aquamarine",
      name: "Aquamarine",
      beadTypeId: "crystal",
      beadTypeSlug: "crystal",
      image: "https://example.com/p.png",
      processedImage: "https://example.com/p.png",
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

describe("strand normalized asset rendering", () => {
  it("loads full-resolution normalized URL without Supabase render resize", () => {
    const url = getBeadImageUrl(placedBead(), {
      beadSizes: [{ id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: GROUP_REF }],
      beadLibrarySizes: [],
    });
    expect(url).toContain(NORMALIZED_URL);
    expect(url).not.toContain("/render/image/");
  });

  it("uses passive mm slot sizing without object-fit or clip-path", () => {
    const bead = placedBead();
    const sizing = resolveBeadSlotSizing(bead, 6, 1, {
      beadSizes: [{ id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: GROUP_REF }],
    });
    expect(sizing.sizingPath).toBe("normalizedVisibleDiameter");
    expect(sizing.objectFit).toBeNull();
    expect(sizing.usesClipPath).toBe(false);

    const style = getStrandBeadImageStyle(bead.bead, sizing);
    expect(style.objectFit).toBe("fill");
    expect(style.clipPath).toBeUndefined();
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
  });
});
