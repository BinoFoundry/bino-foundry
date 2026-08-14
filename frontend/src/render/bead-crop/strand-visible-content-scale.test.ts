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
import { TEST_STRAND_RENDER_CATALOGUE } from "./strand-render-test-catalogue";

const PROCESSED_A = "https://example.com/charm-padded.png";
const PROCESSED_B = "https://example.com/charm-tight.png";
const PROCESSED_C = "https://example.com/bead-round.png";
const PROCESSED_CRYSTAL = "https://example.com/crystal-round.png";

function placed(
  id: string,
  processedUrl: string,
  /** Crop-mask metrics (may overstate painted content). */
  maskVisible: { w: number; h: number },
  processedCanvas: { w: number; h: number },
  sizeMm = 8,
  beadType: { id: string; slug: string } = { id: "type-charm", slug: "charm" },
): PlacedBead {
  const maskD = Math.max(maskVisible.w, maskVisible.h);
  return {
    position: 0,
    size: { offerKey: `${id}-${sizeMm}`, sizeMm, label: `${sizeMm} mm`, unitPrice: 1 },
    bead: {
      id,
      name: id,
      beadTypeId: beadType.id,
      beadTypeSlug: beadType.slug,
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

  it("without live alpha metrics, dangling still uses mm square + contain-top", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    // Mask = full 500px square on 540 canvas — must not change shell or fit mode.
    const padded = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    expect(padded.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(padded.dimensions.height).toBeCloseTo(wrapper, 5);
    expect(padded.strandImageFit).toBe("contain-top");
    expect(padded.imageOffsetPx).toEqual({ left: 0, top: 0 });
    expect(padded.imageDimensions).toEqual(padded.dimensions);
  });

  it("dangling charms share a catalogue-mm square with contain-top fit", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    const contentW = 220;
    const contentH = 380;
    const canvas = 540;

    seedProcessedStrandMetrics(PROCESSED_A, {
      visibleWidthPx: contentW,
      visibleHeightPx: contentH,
      referenceDiameterPx: contentH,
      visibleDiameterPx: contentH,
      processedWidthPx: canvas,
      processedHeightPx: canvas,
      visibleOriginXPx: 160,
      visibleOriginYPx: 20,
    });
    seedProcessedStrandMetrics(PROCESSED_B, {
      visibleWidthPx: 450,
      visibleHeightPx: 450,
      referenceDiameterPx: 450,
      visibleDiameterPx: 450,
      processedWidthPx: 486,
      processedHeightPx: 486,
    });
    seedProcessedStrandMetrics(PROCESSED_C, {
      visibleWidthPx: 400,
      visibleHeightPx: 400,
      referenceDiameterPx: 400,
      visibleDiameterPx: 400,
      processedWidthPx: 432,
      processedHeightPx: 432,
    });

    const padded = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: canvas, h: canvas }),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    const tight = resolveBeadSlotSizing(
      placed("tight", PROCESSED_B, { w: 450, h: 450 }, { w: 486, h: 486 }),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    const round = resolveBeadSlotSizing(
      placed("round", PROCESSED_C, { w: 400, h: 400 }, { w: 432, h: 432 }, 8),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );

    // Identical mm → identical shell + contain-top (no per-asset image offsets).
    expect(padded.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(padded.dimensions.height).toBeCloseTo(wrapper, 5);
    expect(tight.dimensions).toEqual(padded.dimensions);
    expect(round.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(padded.strandImageFit).toBe("contain-top");
    expect(tight.strandImageFit).toBe("contain-top");
    expect(padded.imageOffsetPx).toEqual({ left: 0, top: 0 });
    expect(padded.imageDimensions).toEqual(padded.dimensions);
  });

  it("same mm: dangling charm square matches crystal wrapper", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    const charmContentW = 220;
    const charmCanvas = 540;
    const crystalContent = 400;
    const crystalCanvas = 420;

    seedProcessedStrandMetrics(PROCESSED_A, {
      visibleWidthPx: charmContentW,
      visibleHeightPx: 380,
      referenceDiameterPx: 380,
      visibleDiameterPx: 380,
      processedWidthPx: charmCanvas,
      processedHeightPx: charmCanvas,
    });
    seedProcessedStrandMetrics(PROCESSED_CRYSTAL, {
      visibleWidthPx: crystalContent,
      visibleHeightPx: crystalContent,
      referenceDiameterPx: crystalContent,
      visibleDiameterPx: crystalContent,
      processedWidthPx: crystalCanvas,
      processedHeightPx: crystalCanvas,
    });

    const charm = resolveBeadSlotSizing(
      placed("charm", PROCESSED_A, { w: 500, h: 500 }, { w: charmCanvas, h: charmCanvas }),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    const crystal = resolveBeadSlotSizing(
      placed(
        "crystal",
        PROCESSED_CRYSTAL,
        { w: crystalContent, h: crystalContent },
        { w: crystalCanvas, h: crystalCanvas },
        8,
        { id: "type-crystal", slug: "crystal" },
      ),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );

    expect(charm.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(charm.dimensions.height).toBeCloseTo(wrapper, 5);
    expect(crystal.wrapperDiameterPx).toBeCloseTo(wrapper, 5);
    expect(charm.strandImageFit).toBe("contain-top");
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
      TEST_STRAND_RENDER_CATALOGUE,
    );
    const eight = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }, 8),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    const twelve = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }, 12),
      12,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );

    expect(six.dimensions.width).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(six.dimensions.height).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(eight.dimensions.width).toBeCloseTo(layoutDiameterPxForMm(8, 1), 5);
    expect(twelve.dimensions.width).toBeCloseTo(layoutDiameterPxForMm(12, 1), 5);
    expect(six.strandImageFit).toBe("contain-top");
    expect(six.wrapperDiameterPx).toBeLessThan(eight.wrapperDiameterPx);
    expect(eight.wrapperDiameterPx).toBeLessThan(twelve.wrapperDiameterPx);
  });
});
