import { describe, expect, it } from "vitest";

import {
  capExportCanvasDimensions,
  needsNormalizedExportRegeneration,
} from "@bino-foundry/shared/types";

import { filterStaleNormalizationTargets } from "./normalized-bead-export";

describe("normalized export optimization", () => {
  it("caps oversized export canvases", () => {
    const capped = capExportCanvasDimensions(2400, 1800, 512);
    expect(capped.width).toBe(512);
    expect(capped.height).toBe(384);
    expect(capped.downscale).toBeCloseTo(512 / 2400, 4);
  });

  it("skips regeneration when normalized export matches cached group reference", () => {
    expect(
      needsNormalizedExportRegeneration({
        sizeMm: 6,
        groupReferenceDiameterPx: 400,
        assetVisibleDiameterPx: 320,
        normalizedVisibleDiameterPx: 400,
        storedAssetVisibleDiameterPx: 320,
        needsNormalizedReexport: false,
        cropUpdatedAt: 100,
        normalizedSavedAt: 200,
      }),
    ).toBe(false);
  });

  it("requires regeneration when crop is newer than normalized save", () => {
    expect(
      needsNormalizedExportRegeneration({
        sizeMm: 6,
        groupReferenceDiameterPx: 400,
        assetVisibleDiameterPx: 320,
        normalizedVisibleDiameterPx: 400,
        storedAssetVisibleDiameterPx: 320,
        needsNormalizedReexport: false,
        cropUpdatedAt: 300,
        normalizedSavedAt: 200,
      }),
    ).toBe(true);
  });

  it("filters stale targets only", () => {
    const stale = filterStaleNormalizationTargets(
      [
        { sizeMm: 6, groupReferenceDiameterPx: 400 },
        { sizeMm: 8, groupReferenceDiameterPx: 500 },
      ],
      [
        {
          id: "a",
          beadLibraryId: "lib",
          beadSizeId: "s6",
          sizeMm: 6,
          label: "6 mm",
          unitPrice: 1,
          offerKey: "lib-6",
          normalizedVisibleDiameterPx: 400,
          assetVisibleDiameterPx: 320,
          groupReferenceDiameterPx: 400,
          updatedAt: new Date(500).toISOString(),
        },
        {
          id: "b",
          beadLibraryId: "lib",
          beadSizeId: "s8",
          sizeMm: 8,
          label: "8 mm",
          unitPrice: 1,
          offerKey: "lib-8",
          needsNormalizedReexport: true,
        },
      ],
      320,
      100,
    );
    expect(stale.map((t) => t.sizeMm)).toEqual([8]);
  });
});
