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

  it("without live alpha metrics, inflated mask does not use full canvas as scale denom", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    // Mask = full 500px square on 540 canvas — previously used as scale denom → speck.
    const padded = resolveBeadSlotSizing(
      placed("padded", PROCESSED_A, { w: 500, h: 500 }, { w: 540, h: 540 }),
      8,
      1,
      TEST_STRAND_RENDER_CATALOGUE,
    );
    // Content shell stays mm-wide (packing footprint), not padded-canvas-wide.
    expect(padded.dimensions.width).toBeCloseTo(wrapper, 5);
    // Image layer is larger than the shell (pad hangs outside; overflow clips it).
    expect(padded.imageDimensions.width).toBeGreaterThan(wrapper * 1.05);
    // Scale denom recovered below full canvas (~0.7 assumed fill → scale > W/540).
    expect(padded.imageRenderScale).toBeGreaterThan(wrapper / 540);
  });

  it("live processed alpha metrics paint dangling WIDTH to the mm wrapper", () => {
    const wrapper = layoutDiameterPxForMm(8, 1);
    const contentW = 220;
    const contentH = 380;
    const canvas = 540;

    // Padded tall charm: mask claimed 500×500; painted content 220×380 on 540 canvas.
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
    // Tight square charm: content fills mask.
    seedProcessedStrandMetrics(PROCESSED_B, {
      visibleWidthPx: 450,
      visibleHeightPx: 450,
      referenceDiameterPx: 450,
      visibleDiameterPx: 450,
      processedWidthPx: 486,
      processedHeightPx: 486,
    });
    // Round-ish dangling asset.
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

    // Content shell width = catalogue mm (what packing / CSS shell use).
    expect(padded.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(tight.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(round.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(padded.visibleContentWidthPx).toBeCloseTo(wrapper, 5);

    // Painted width = contentW × scale ≈ mm wrapper (not canvas×scale).
    expect(padded.imageRenderScale * contentW).toBeCloseTo(wrapper, 5);
    expect(padded.imageDimensions.width).toBeCloseTo(canvas * (wrapper / contentW), 5);
    // Origin-aligned: content left edge lands at shell left (not centered pad).
    expect(padded.imageOffsetPx.left).toBeCloseTo(-160 * (wrapper / contentW), 5);
    expect(padded.imageOffsetPx.top).toBeCloseTo(-20 * (wrapper / contentW), 5);
    // Tall charm: shell grows in height with content aspect; width stays mm.
    expect(padded.dimensions.height / padded.dimensions.width).toBeCloseTo(contentH / contentW, 5);
    expect(padded.visibleContentWidthPx! / padded.visibleContentHeightPx!).toBeCloseTo(
      contentW / contentH,
      5,
    );

    // Live metrics override inflated mask diameter.
    expect(padded.assetVisibleDiameterPx).toBe(contentH);
  });

  it("same mm: dangling charm painted width matches crystal shell width", () => {
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

    // Both occupy the same mm wrapper for their primary visual axis.
    expect(charm.dimensions.width).toBeCloseTo(wrapper, 5);
    expect(crystal.wrapperDiameterPx).toBeCloseTo(wrapper, 5);
    expect(charm.imageRenderScale * charmContentW).toBeCloseTo(crystal.wrapperDiameterPx, 5);
    // Charm must not look like a speck vs crystal (ratio was historically ~0.4).
    const paintedCharmWidth = charm.imageRenderScale * charmContentW;
    expect(paintedCharmWidth / crystal.wrapperDiameterPx).toBeGreaterThan(0.95);
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

    // Dangling width-match: content width tracks catalogue mm.
    expect(six.visibleContentWidthPx).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(eight.visibleContentWidthPx).toBeCloseTo(layoutDiameterPxForMm(8, 1), 5);
    expect(twelve.visibleContentWidthPx).toBeCloseTo(layoutDiameterPxForMm(12, 1), 5);
    expect(six.imageRenderScale * 220).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(eight.imageRenderScale * 220).toBeCloseTo(layoutDiameterPxForMm(8, 1), 5);
    expect(twelve.imageRenderScale * 220).toBeCloseTo(layoutDiameterPxForMm(12, 1), 5);
    expect(six.visibleContentWidthPx!).toBeLessThan(eight.visibleContentWidthPx!);
    expect(eight.visibleContentWidthPx!).toBeLessThan(twelve.visibleContentWidthPx!);
    expect(six.wrapperDiameterPx).toBeLessThan(eight.wrapperDiameterPx);
    expect(eight.wrapperDiameterPx).toBeLessThan(twelve.wrapperDiameterPx);
  });
});
