import { describe, expect, it } from "vitest";

import {
  computeMmGroupNormalizationFactor,
  effectiveMmTargetDiameterPx,
} from "@bino-foundry/shared/types";

import { resolveBeadSlotSizing } from "@/render/bead-crop/strand-bead-sizing";
import { mmToBasePx } from "@/render/bead-crop/strand-bead";
import type { PlacedBead } from "@/lib/luxe-data";
import { BEAD_CROP_CONFIG_V2, type BeadCropConfigV2 } from "@bino-foundry/shared/types";
import type { BeadSlotSizingCatalogueContext } from "@/render/bead-crop/strand-bead-sizing";

const GROUP_REF = 765;

function beadConfig(visibleDiameter: number, processedMax = visibleDiameter + 78): BeadCropConfigV2 {
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 1000,
    imageHeight: 1000,
    originalUrl: "https://example.com/a.png",
    processedUrl: "https://example.com/p.png",
    points: [],
    scale: 1,
    physicalMetrics: {
      visibleWidthPx: visibleDiameter,
      visibleHeightPx: visibleDiameter,
      referenceDiameterPx: visibleDiameter,
      processedWidthPx: processedMax,
      processedHeightPx: processedMax,
    },
  };
}

function mockPlaced(
  name: string,
  visibleDiameter: number,
  factor: number,
): PlacedBead {
  return {
    position: 0,
    size: {
      offerKey: `k-${name}`,
      sizeMm: 6,
      label: "6 mm",
      unitPrice: 1,
      normalizationFactor: factor,
      assetVisibleDiameterPx: visibleDiameter,
    },
    bead: {
      id: name,
      name,
      beadTypeId: "t",
      image: "https://example.com/p.png",
      processedImage: "https://example.com/p.png",
      description: "",
      cropConfig: beadConfig(visibleDiameter),
    },
  };
}

const catalogue: BeadSlotSizingCatalogueContext = {
  beadSizes: [
    {
      id: "size-6",
      sizeMm: 6,
      label: "6 mm",
      groupReferenceDiameterPx: GROUP_REF,
    },
  ],
};

describe("mm group normalization", () => {
  it("computes per-asset factor from group reference and visible diameter", () => {
    expect(computeMmGroupNormalizationFactor(GROUP_REF, GROUP_REF)).toBeCloseTo(1, 5);
    expect(computeMmGroupNormalizationFactor(GROUP_REF, 622)).toBeCloseTo(GROUP_REF / 622, 4);
    expect(computeMmGroupNormalizationFactor(GROUP_REF, 504)).toBeCloseTo(GROUP_REF / 504, 4);
    expect(computeMmGroupNormalizationFactor(GROUP_REF, 354)).toBeCloseTo(GROUP_REF / 354, 4);
  });

  it("scales render target by normalization factor", () => {
    const base = mmToBasePx(6, 1);
    expect(effectiveMmTargetDiameterPx(base, GROUP_REF / 622)).toBeCloseTo(base * (GROUP_REF / 622), 4);
  });

  it("assigns the same mm slot regardless of stored crop metrics", () => {
    const base = mmToBasePx(6, 1);
    const cases = [
      { name: "gold", visible: 765, factor: 1 },
      { name: "aqua", visible: 622, factor: GROUP_REF / 622 },
      { name: "abacus", visible: 354, factor: GROUP_REF / 354 },
    ];

    for (const { name, visible, factor } of cases) {
      const sizing = resolveBeadSlotSizing(mockPlaced(name, visible, factor), 6, 1, catalogue);
      expect(sizing.actualVisibleDiameterPx).toBeCloseTo(base, 1);
    }
  });

  it("uses canonical processed asset with uniform runtime scaling", () => {
    const base = mmToBasePx(6, 1);
    const sizing = resolveBeadSlotSizing(
      {
        position: 0,
        size: {
          offerKey: "k-small",
          sizeMm: 6,
          label: "6 mm",
          unitPrice: 1,
          normalizedProcessedImageUrl: "https://example.com/n.webp",
          normalizedVisibleDiameterPx: GROUP_REF,
          normalizedDeliveryUrls: { webp: "https://example.com/n.webp" },
          groupReferenceDiameterPx: GROUP_REF,
        },
        bead: {
          id: "small",
          name: "small",
          beadTypeId: "t",
          image: "https://example.com/p.png",
          processedImage: "https://example.com/p.png",
          description: "",
          cropConfig: beadConfig(354),
        },
      },
      6,
      1,
      catalogue,
    );

    expect(sizing.sizingPath).toBe("normalizedVisibleDiameter");
    expect(sizing.mmGroupActive).toBe(false);
    expect(sizing.objectFit).toBeNull();
    expect(sizing.actualVisibleDiameterPx).toBeCloseTo(base, 1);
  });
});
