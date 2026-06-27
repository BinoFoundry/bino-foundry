import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import { resolveBeadSlotSizing } from "@/render/bead-crop/strand-bead-sizing";
import { mmToBasePx } from "@/render/bead-crop/strand-bead";
import type { PlacedBead } from "@/lib/luxe-data";

function mockPlaced(
  name: string,
  occupancyRatio: number,
  visibleDiameter: number,
): PlacedBead {
  const processed = Math.round(visibleDiameter * 1.08);
  return {
    position: 0,
    size: {
      offerKey: `k-${name}`,
      sizeMm: 6,
      label: "6 mm",
      unitPrice: 1,
      normalizationFactor: 1,
    },
    bead: {
      id: name,
      name,
      beadTypeId: "t",
      image: "https://example.com/p.png",
      processedImage: "https://example.com/p.png",
      description: "",
      cropConfig: {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 1000,
        imageHeight: 1000,
        originalUrl: "https://example.com/a.png",
        processedUrl: "https://example.com/p.png",
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.75, y: 0.25 },
          { x: 0.75, y: 0.75 },
          { x: 0.25, y: 0.75 },
        ],
        scale: 1,
        visualBounds: {
          width: visibleDiameter / 1000,
          height: visibleDiameter / 1000,
          centerX: 0.5,
          centerY: 0.5,
        },
        physicalMetrics: {
          visibleWidthPx: visibleDiameter,
          visibleHeightPx: visibleDiameter,
          referenceDiameterPx: visibleDiameter,
          processedWidthPx: processed,
          processedHeightPx: processed,
          occupancyRatio,
          polygonDiameterPx: Math.round(visibleDiameter / occupancyRatio),
        },
      },
    },
  };
}

describe("strand render sizing", () => {
  it("uses mm slot size only — no occupancy compensation on image layer", () => {
    const base = mmToBasePx(6, 1);
    const lowOcc = resolveBeadSlotSizing(mockPlaced("low", 0.65, 600), 6, 1);
    const highOcc = resolveBeadSlotSizing(mockPlaced("high", 0.92, 600), 6, 1);

    expect(lowOcc.finalRenderWidthPx).toBeCloseTo(highOcc.finalRenderWidthPx, 1);
    expect(lowOcc.actualVisibleDiameterPx).toBeCloseTo(base, 1);
    expect(lowOcc.imageRenderWidthPx).toBeCloseTo(highOcc.imageRenderWidthPx, 1);
    expect(lowOcc.occupancyRatio).toBe(1);
    expect(lowOcc.objectFit).toBeNull();
  });
});
