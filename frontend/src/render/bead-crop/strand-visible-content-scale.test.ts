import { afterEach, describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import { layoutDiameterPxForMm } from "./canonical-strand-mm-scale";
import { physicalMetricsFromVisibleFootprint } from "./crop-path";
import {
  clearProcessedStrandMetricsCache,
  seedProcessedStrandMetrics,
} from "./processed-strand-metrics";
import { resolveBeadSlotSizing } from "./strand-bead-sizing";

const PROCESSED_A = "https://example.com/charm-padded.png";
const PROCESSED_B = "https://example.com/charm-tight.png";
const PROCESSED_C = "https://example.com/bead-round.png";

function placed(
  id: string,
  processedUrl: string,
  /** Crop-mask metrics (may overstate painted content). */
  maskVisible: { w: number; h: number },
  processedCanvas: { w: number; h: number },
  sizeMm = 8,
): PlacedBead {
  const maskD = Math.max(maskVisible.w, maskVisible.h);
  return {
    position: 0,
    size: { offerKey: `${id}-${sizeMm}`, sizeMm, label: `${sizeMm} mm`, unitPrice: 1 },
    bead: {
      id,
      name: id,
      beadTypeId: "charm",
      beadTypeSlug: "charm",
      image: processedUrl,
      processedImage: processedUrl,
      description: "",
      cropConfig: {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 1000,
        imageHeight: 1000,
        originalUrl: "https://example.com/o.png",
        processedUrl,
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 },
        ],
        scale: 1,
        physicalMetrics: {
          visibleWidthPx: maskVisible.w,
          visibleHeightPx: maskVisible.h,
          referenceDiameterPx: maskD,
          visibleDiameterPx: maskD,
          processedWidthPx: processedCanvas.w,
          processedHeightPx: processedCanvas.h,
        },
      },
    },
  };
}

afterEach(() => {
  clearProcessedStrandMetricsCache();
});

describe("same-mm visual size from painted content bounds", () => {
  it("physicalMetricsFromVisibleFootprint uses alpha footprint, not canvas alone", () => {
    const metrics = physicalMetricsFromVisibleFootprint(
      { x: 40, y: 10, width: 220, height: 380, diameterPx: 380 },
      500,
      500,
    );
    expect(metrics.visibleWidthPx).toBe(220);
    expect(metrics.visibleHeightPx).toBe(380);
    expect(metrics.visibleDiameterPx).toBe(380);
    expect(metrics.processedWidthPx).toBe(500);
    expect(metrics.processedHeightPx).toBe(500);
  });

  it("without live alpha metrics, inflated mask makes sparse charms underscale", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    // Mask = full 500px square, but content is only 220×380 (max 380).
    const padded = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }),
      8,
      1,
    );
    // Scale uses mask diameter 500 → visible content maps below wrapper.
    expect(padded.actualVisibleDiameterPx).toBeCloseTo(wrapper, 5);
    // Image scale denom is mask (500), so content fraction 380/500 of wrapper appears small
    // once live metrics are applied below — here we only assert mask path uses 500.
    expect(padded.assetVisibleDiameterPx).toBe(500);
  });

  it("live processed alpha metrics equalize same-mm visual diameter across padding/aspect", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);

    // Padded tall charm: mask claimed 500×500; painted content 220×380 on 540 canvas.
    seedProcessedStrandMetrics(PROCESSED_A, {
      visibleWidthPx: 220,
      visibleHeightPx: 380,
      referenceDiameterPx: 380,
      visibleDiameterPx: 380,
      processedWidthPx: 540,
      processedHeightPx: 540,
    });
    // Tight square charm: content fills mask.
    seedProcessedStrandMetrics(PROCESSED_B, {
      visibleWidthPx: 450,
      visibleHeightPx: 450,
      referenceDiameterPx: 450,
      visibleDiameterPx: 450,
      processedWidthPx: 486,
      processedHeightPx: 486,
    });
    // Round bead.
    seedProcessedStrandMetrics(PROCESSED_C, {
      visibleWidthPx: 400,
      visibleHeightPx: 400,
      referenceDiameterPx: 400,
      visibleDiameterPx: 400,
      processedWidthPx: 432,
      processedHeightPx: 432,
    });

    const padded = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }),
      8,
      1,
    );
    const tight = resolveBeadSlotSizing(
      placed("tight", PROCESSED_B, { w: 450, h: 450 }, { w: 486, h: 486 }),
      8,
      1,
    );
    const round = resolveBeadSlotSizing(
      placed("round", PROCESSED_C, { w: 400, h: 400 }, { w: 432, h: 432 }, 8),
      8,
      1,
    );

    // Painted max-edge maps to the mm wrapper for every asset.
    expect(padded.actualVisibleDiameterPx).toBeCloseTo(wrapper, 5);
    expect(tight.actualVisibleDiameterPx).toBeCloseTo(wrapper, 5);
    expect(round.actualVisibleDiameterPx).toBeCloseTo(wrapper, 5);

    // Aspect preserved: tall charm width < height after scale.
    expect(padded.visibleContentWidthPx!).toBeLessThan(padded.visibleContentHeightPx!);
    expect(padded.visibleContentWidthPx! / padded.visibleContentHeightPx!).toBeCloseTo(220 / 380, 5);

    // Live metrics override inflated mask diameter.
    expect(padded.assetVisibleDiameterPx).toBe(380);
  });

  it("different mm sizes still scale proportionally with live metrics", () => {
    seedProcessedStrandMetrics(PROCESSED_A, {
      visibleWidthPx: 220,
      visibleHeightPx: 380,
      referenceDiameterPx: 380,
      visibleDiameterPx: 380,
      processedWidthPx: 540,
      processedHeightPx: 540,
    });

    const six = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }, 6),
      6,
      1,
    );
    const eight = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }, 8),
      8,
      1,
    );
    const twelve = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }, 12),
      12,
      1,
    );

    expect(six.actualVisibleDiameterPx).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(eight.actualVisibleDiameterPx).toBeCloseTo(layoutDiameterPxForMm(8, 1), 5);
    expect(twelve.actualVisibleDiameterPx).toBeCloseTo(layoutDiameterPxForMm(12, 1), 5);
    expect(six.wrapperDiameterPx).toBeLessThan(eight.wrapperDiameterPx);
    expect(eight.wrapperDiameterPx).toBeLessThan(twelve.wrapperDiameterPx);
  });
});
