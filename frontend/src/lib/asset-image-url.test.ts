import { describe, expect, it } from "vitest";

import { resolveAssetImageUrl, withAssetCacheBuster } from "./asset-image-url";

describe("resolveAssetImageUrl", () => {
  it("returns full URL unchanged for full variant", () => {
    const url = "https://cdn.example.com/bead.png";
    expect(resolveAssetImageUrl(url, "full")).toBe(url);
  });

  it("applies Cloudinary width transform for thumbnail", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v123/folder/bead.png";
    const result = resolveAssetImageUrl(url, "thumbnail");
    expect(result).toContain("w_150,c_limit,f_auto,q_auto");
    expect(result).toContain("/v123/folder/bead.png");
  });

  it("applies Cloudinary medium width", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    const result = resolveAssetImageUrl(url, "medium");
    expect(result).toContain("w_500,c_limit,f_auto,q_auto");
  });

  it("uses Supabase render endpoint when available", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/assets/beads/x.png";
    const result = resolveAssetImageUrl(url, "medium");
    expect(result).toBe(
      "https://abc.supabase.co/storage/v1/render/image/public/assets/beads/x.png?width=500&quality=85",
    );
  });

  it("preserves data URLs", () => {
    const data = "data:image/png;base64,abc";
    expect(resolveAssetImageUrl(data, "thumbnail")).toBe(data);
  });
});

describe("withAssetCacheBuster", () => {
  it("appends query param", () => {
    expect(withAssetCacheBuster("https://x.com/a.png")).toBe("https://x.com/a.png?v=2");
    expect(withAssetCacheBuster("https://x.com/a.png?w=500")).toBe("https://x.com/a.png?w=500&v=2");
  });
});
