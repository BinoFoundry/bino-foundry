import { describe, expect, it } from "vitest";

import { collectBeadLibraryAssetUrls } from "./bead-library-assets.js";

describe("collectBeadLibraryAssetUrls", () => {
  it("collects original, processed, crop delivery, and normalized size URLs", () => {
    const urls = collectBeadLibraryAssetUrls(
      {
        original_image_url: "https://example.supabase.co/storage/v1/object/public/assets/original.png",
        processed_image_url: "https://example.supabase.co/storage/v1/object/public/assets/processed.webp",
        crop_config: {
          originalUrl: "https://example.supabase.co/storage/v1/object/public/assets/original.png",
          processedUrl: "https://example.supabase.co/storage/v1/object/public/assets/processed.webp",
          deliveryUrls: {
            webp: "https://example.supabase.co/storage/v1/object/public/assets/processed.webp",
            png: "https://example.supabase.co/storage/v1/object/public/assets/processed.png",
          },
        },
        specs: { legacy_image_url: "https://example.supabase.co/storage/v1/object/public/assets/legacy.png" },
      },
      [
        {
          normalized_processed_image_url:
            "https://example.supabase.co/storage/v1/object/public/assets/norm-6.webp",
          normalized_delivery_urls: {
            avif: "https://example.supabase.co/storage/v1/object/public/assets/norm-6.avif",
          },
        },
      ],
    );

    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/original.png");
    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/processed.webp");
    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/processed.png");
    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/legacy.png");
    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/norm-6.webp");
    expect(urls).toContain("https://example.supabase.co/storage/v1/object/public/assets/norm-6.avif");
  });

  it("ignores data URLs and empty strings", () => {
    expect(
      collectBeadLibraryAssetUrls({
        original_image_url: "data:image/png;base64,abc",
        processed_image_url: "",
      }),
    ).toEqual([]);
  });
});
