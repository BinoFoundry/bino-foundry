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
  it("round beads use a square layout at the target visible diameter", () => {
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
    expect(dim.width).toBeCloseTo(dim.height, 5);
    expect(dim.width).toBeCloseTo(mmToBasePx(8, 1), 1);
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

  it("round spacers use the same mm slot as other round beads", () => {
    const config = {
      version: BEAD_CROP_CONFIG_V1,
      imageWidth: 100,
      imageHeight: 100,
      originalUrl: "https://example.com/spacer.png",
      crop: { x: 0.1, y: 0.2, width: 0.75, height: 0.35 },
      scale: 1,
    } as const;
    const spacer = getBeadSlotDimensions(
      {
        ...mockPlaced(config),
        bead: { ...mockPlaced(config).bead, beadTypeSlug: "spacer" },
      },
      8,
      1,
    );
    expect(spacer.width).toBeCloseTo(spacer.height, 5);
    expect(spacer.width).toBeCloseTo(mmToBasePx(8, 1), 1);
  });
});
