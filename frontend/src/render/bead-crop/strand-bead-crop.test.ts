import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V1 } from "@bino-foundry/shared/types";
import type { PlacedBead } from "@/lib/luxe-data";

import { beadVisualBoundsFromCropConfig } from "./crop-visual-bounds";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";
import { getBeadSlotDimensions, getBeadTangentArcPx, mmToBasePx } from "./strand-bead";

function mockPlaced(cropConfig: PlacedBead["bead"]["cropConfig"]): PlacedBead {
  return {
    position: 0,
    size: { offerKey: "k", sizeMm: 8, label: "8 mm", unitPrice: 1 },
    bead: {
      id: "b1",
      name: "Test",
      beadTypeSlug: "crystal",
      originalImage: "https://example.com/a.png",
      cropConfig,
    } as PlacedBead["bead"],
  };
}

describe("beadVisualBoundsFromCropConfig", () => {
  it("returns unit bounds when crop is missing", () => {
    expect(beadVisualBoundsFromCropConfig(null)).toEqual({
      width: 1,
      height: 1,
      centerX: 0.5,
      centerY: 0.5,
    });
  });
});

describe("getBeadSlotDimensions", () => {
  it("matches crop aspect ratio instead of forcing a square wrapper", () => {
    const config = {
      version: BEAD_CROP_CONFIG_V1,
      imageWidth: 100,
      imageHeight: 100,
      originalUrl: "https://example.com/a.png",
      crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.4 },
      scale: 1,
    } as const;
    const placed = mockPlaced(config);
    const dim = getBeadSlotDimensions(placed, 8, 1);
    const ratio = dim.width / dim.height;
    expect(ratio).toBeCloseTo(1.5, 1);
    expect(Math.max(dim.width, dim.height)).toBeCloseTo(mmToBasePx(8, 1), 1);
  });

  it("scales proportionally with mm", () => {
    const config = {
      version: BEAD_CROP_CONFIG_V1,
      imageWidth: 100,
      imageHeight: 100,
      originalUrl: "https://example.com/a.png",
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      scale: 1,
    } as const;
    const small = getBeadSlotDimensions(mockPlaced(config), 2, 1);
    const large = getBeadSlotDimensions(mockPlaced(config), 8, 1);
    expect(large.width / small.width).toBeCloseTo(
      calibratedVisualDiameterPx(8) / calibratedVisualDiameterPx(2),
      1,
    );
  });

  it("uses crop-tight tangent arc for layout spacing", () => {
    const config = {
      version: BEAD_CROP_CONFIG_V1,
      imageWidth: 100,
      imageHeight: 100,
      originalUrl: "https://example.com/a.png",
      crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.4 },
      scale: 1,
    } as const;
    const dim = getBeadSlotDimensions(mockPlaced(config), 8, 1);
    expect(getBeadTangentArcPx(dim)).toBeCloseTo(dim.width, 5);
  });
});
