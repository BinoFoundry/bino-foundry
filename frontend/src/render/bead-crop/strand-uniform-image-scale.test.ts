import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";
import { BEAD_CROP_CONFIG_V2, type BeadCropConfigV2 } from "@bino-foundry/shared/types";

import { layoutDiameterPxForMm } from "./canonical-strand-mm-scale";
import { getStrandBeadImageStyle } from "./strand-bead";
import { resolveBeadSlotSizing } from "./strand-bead-sizing";

function beadConfig(metrics: BeadCropConfigV2["physicalMetrics"]): BeadCropConfigV2 {
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 1200,
    imageHeight: 2400,
    originalUrl: "https://example.com/o.png",
    processedUrl: "https://example.com/p.png",
    points: [],
    scale: 1,
    physicalMetrics: metrics,
  };
}

function placed(crop: BeadCropConfigV2): PlacedBead {
  return {
    position: 0,
    size: { offerKey: "k", sizeMm: 6, label: "6 mm", unitPrice: 1 },
    bead: {
      id: "test",
      name: "Test",
      beadTypeId: "crystal",
      beadTypeSlug: "crystal",
      image: "https://example.com/p.png",
      processedImage: "https://example.com/p.png",
      description: "",
      cropConfig: crop,
    },
  };
}

describe("uniform strand image scaling", () => {
  const processedW = 500;
  const processedH = 1080;
  const visible = 400;

  it("preserves processed canvas aspect ratio inside mm wrapper", () => {
    const sizing = resolveBeadSlotSizing(
      placed(
        beadConfig({
          visibleWidthPx: visible,
          visibleHeightPx: visible,
          referenceDiameterPx: visible,
          processedWidthPx: processedW,
          processedHeightPx: processedH,
        }),
      ),
      6,
      1,
    );

    const expectedAspect = processedW / processedH;
    expect(sizing.imageDimensions.width / sizing.imageDimensions.height).toBeCloseTo(expectedAspect, 5);
    expect(sizing.dimensions.width).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(sizing.dimensions.height).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(sizing.imageRenderScale).not.toBeNull();
    expect(sizing.imageRenderScale).toBeGreaterThan(0);
  });

  it("uses uniform scale (scaleX equals scaleY)", () => {
    const sizing = resolveBeadSlotSizing(
      placed(
        beadConfig({
          visibleWidthPx: visible,
          visibleHeightPx: visible,
          referenceDiameterPx: visible,
          processedWidthPx: processedW,
          processedHeightPx: processedH,
        }),
      ),
      6,
      1,
    );

    const scaleX = sizing.imageDimensions.width / processedW;
    const scaleY = sizing.imageDimensions.height / processedH;
    expect(scaleX).toBeCloseTo(scaleY, 8);
    expect(scaleX).toBeCloseTo(sizing.imageRenderScale!, 8);
  });

  it("orders wrapper diameter strictly by configured mm", () => {
    const bead = placed(
      beadConfig({
        visibleWidthPx: 765,
        visibleHeightPx: 765,
        referenceDiameterPx: 765,
        processedWidthPx: 843,
        processedHeightPx: 843,
      }),
    );
    const six = resolveBeadSlotSizing(bead, 6, 1);
    const seven = resolveBeadSlotSizing(bead, 7, 1);
    const eight = resolveBeadSlotSizing(bead, 8, 1);
    const ten = resolveBeadSlotSizing(bead, 10, 1);

    expect(six.wrapperDiameterPx).toBeLessThan(seven.wrapperDiameterPx);
    expect(seven.wrapperDiameterPx).toBeLessThan(eight.wrapperDiameterPx);
    expect(eight.wrapperDiameterPx).toBeLessThan(ten.wrapperDiameterPx);
    expect(six.wrapperDiameterPx).toBeCloseTo(layoutDiameterPxForMm(6, 1), 5);
    expect(ten.wrapperDiameterPx).toBeCloseTo(layoutDiameterPxForMm(10, 1), 5);
  });

  it("positions image with explicit pixel dimensions — no object-fit fill", () => {
    const bead = placed(
      beadConfig({
        visibleWidthPx: visible,
        visibleHeightPx: visible,
        referenceDiameterPx: visible,
        processedWidthPx: processedW,
        processedHeightPx: processedH,
      }),
    );
    const sizing = resolveBeadSlotSizing(bead, 6, 1);
    const style = getStrandBeadImageStyle(bead.bead, sizing);

    expect(style.objectFit).toBeUndefined();
    expect(style.width).toBe(sizing.imageDimensions.width);
    expect(style.height).toBe(sizing.imageDimensions.height);
    expect(style.position).toBe("absolute");
  });
});
