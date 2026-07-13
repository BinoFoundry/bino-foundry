import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";
import type { PlacedBead } from "@/lib/luxe-data";

import { beadContactArcPxFromSizing } from "@/features/bracelet/strand-ring-geometry";

import { getBeadStrandTangentContactPx, resolveBeadSlotSizing } from "./strand-bead-sizing";

function mockPlaced(visibleDiameter: number, processedPad = 40): PlacedBead {
  const config = {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 1000,
    imageHeight: 1000,
    originalUrl: "https://example.com/a.png",
    processedUrl: "https://example.com/processed.png",
    points: [
      { x: 0.3, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.7, y: 0.7 },
      { x: 0.3, y: 0.7 },
    ],
    scale: 1,
    physicalMetrics: {
      visibleWidthPx: visibleDiameter,
      visibleHeightPx: visibleDiameter,
      referenceDiameterPx: visibleDiameter,
      visibleDiameterPx: visibleDiameter,
      processedWidthPx: visibleDiameter + processedPad,
      processedHeightPx: visibleDiameter + processedPad,
    },
  } as const;

  return {
    position: 0,
    size: { offerKey: "k", sizeMm: 8, label: "8 mm", unitPrice: 1 },
    bead: {
      id: "b1",
      name: "Test",
      beadTypeSlug: "crystal",
      originalImage: "https://example.com/a.png",
      processedImage: "https://example.com/processed.png",
      cropConfig: config,
    } as PlacedBead["bead"],
  };
}

describe("getBeadStrandTangentContactPx", () => {
  it("uses export fill ratio when processed canvas has transparent padding", () => {
    const placed = mockPlaced(320, 48);
    const sizing = resolveBeadSlotSizing(placed, 8, 1);
    const tangent = getBeadStrandTangentContactPx(sizing);

    expect(sizing.exportFillRatio).not.toBeNull();
    expect(sizing.exportFillRatio!).toBeLessThan(1);
    expect(tangent).toBeCloseTo(sizing.dimensions.width * sizing.exportFillRatio!, 1);
    expect(tangent).toBeLessThan(sizing.dimensions.width);
  });

  it("matches visible content width from sizing result", () => {
    const placed = mockPlaced(320, 48);
    const sizing = resolveBeadSlotSizing(placed, 8, 1);
    const expected = Math.min(
      sizing.visibleContentWidthPx ?? sizing.dimensions.width,
      sizing.exportFillRatio != null && sizing.exportFillRatio < 1
        ? sizing.dimensions.width * sizing.exportFillRatio
        : sizing.dimensions.width,
    );
    expect(getBeadStrandTangentContactPx(sizing)).toBeCloseTo(expected, 3);
  });

  it("neutral contact width packs using visible diameter not wrapper", () => {
    const placed = mockPlaced(320, 48);
    const sizing = resolveBeadSlotSizing(placed, 8, 1);
    const contact = beadContactArcPxFromSizing(sizing, {
      contactWidth: 1,
      contactOffset: 0,
      spacingAdjustment: 0,
      leadingOverlap: 0,
      trailingOverlap: 0,
      collisionPadding: 0,
    });

    expect(contact.contactArcPx).toBeCloseTo(getBeadStrandTangentContactPx(sizing), 3);
    expect(contact.contactArcPx).toBeLessThan(sizing.dimensions.width);
  });
});
