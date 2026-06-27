import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import { validateBeadAsset } from "@/features/admin/lib/bead-asset-validation";

describe("validateBeadAsset", () => {
  it("flags assets without crop or processed export", () => {
    const result = validateBeadAsset({ cropConfig: null, processedImage: "", image: "" });
    expect(result.status).toBe("needs-adjustment");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("scores a well-centered export with strong footprint", () => {
    const result = validateBeadAsset({
      processedImage: "https://example.com/p.webp",
      image: "https://example.com/p.webp",
      cropConfig: {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 1000,
        imageHeight: 1000,
        originalUrl: "https://example.com/o.png",
        processedUrl: "https://example.com/p.webp",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.8, y: 0.8 },
          { x: 0.2, y: 0.8 },
        ],
        scale: 1,
        physicalMetrics: {
          visibleWidthPx: 560,
          visibleHeightPx: 560,
          referenceDiameterPx: 560,
          processedWidthPx: 620,
          processedHeightPx: 620,
        },
      },
    });
    expect(result.hasProcessedAsset).toBe(true);
    expect(result.visibleFootprintPct).toBeGreaterThan(80);
    expect(result.imageCentered).toBe(true);
    expect(["excellent", "good"]).toContain(result.status);
  });
});
