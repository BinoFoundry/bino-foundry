import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  beadImageCacheToken,
  getBeadLibraryImageUrl,
  resolveStrandDeliveryUrl,
} from "./apply-crop";
import { getBeadLibraryThumbnailStyle } from "./strand-bead";

const PROCESSED = "https://example.supabase.co/storage/v1/object/public/assets/bead.webp";

function bead(overrides: Partial<BeadLibraryEntry> = {}): BeadLibraryEntry {
  return {
    id: "aquamarine",
    name: "Aquamarine",
    beadTypeId: "crystal",
    beadTypeSlug: "crystal",
    image: PROCESSED,
    processedImage: PROCESSED,
    description: "",
    cropConfig: {
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: 800,
      imageHeight: 800,
      originalUrl: "https://example.com/original.png",
      processedUrl: PROCESSED,
      points: [],
      scale: 1,
      updatedAt: 1_700_000_000_000,
      deliveryUrls: {
        webp: PROCESSED,
        png: "https://example.supabase.co/storage/v1/object/public/assets/bead.png",
      },
    },
    ...overrides,
  };
}

describe("bead library thumbnail", () => {
  it("uses the same processed asset as the strand builder (no render resize)", () => {
    const entry = bead();
    const libraryUrl = getBeadLibraryImageUrl(entry);
    const strandUrl = resolveStrandDeliveryUrl(entry);

    expect(libraryUrl).toContain(PROCESSED);
    expect(strandUrl).toBe(PROCESSED);
    expect(libraryUrl).not.toContain("/render/image/");
    expect(libraryUrl).toContain("v=1700000000000");
  });

  it("cache-busts from cropConfig.updatedAt so admin saves refresh thumbnails", () => {
    const entry = bead({ cropConfig: { ...bead().cropConfig!, updatedAt: 1_700_000_111_222 } });
    expect(getBeadLibraryImageUrl(entry)).toContain("v=1700000111222");
    expect(beadImageCacheToken(entry)).toBe("1700000111222");
  });

  it("scales proportionally with transparency preserved", () => {
    const style = getBeadLibraryThumbnailStyle(bead());
    expect(style.objectFit).toBe("contain");
    expect(style.background).toBe("transparent");
    expect(style.maxWidth).toBe("100%");
    expect(style.maxHeight).toBe("100%");
    expect(style.width).toBe("auto");
    expect(style.height).toBe("auto");
    expect(style.clipPath).toBeUndefined();
  });
});
