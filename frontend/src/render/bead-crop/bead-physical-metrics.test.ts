import { describe, expect, it } from "vitest";

import {
  BEAD_CROP_CONFIG_V2,
  resolveBeadPhysicalMetrics,
  resolveBeadPhysicalMetricsForRender,
  type BeadCropConfigV2,
} from "@bino-foundry/shared/types";

import { getBeadSlotDimensions, mmToBasePx, usesProcessedStrandAsset } from "@/render/bead-crop/strand-bead";
import { computeProcessedExportDimensions } from "@/render/bead-crop/crop-path";
import type { PlacedBead } from "@/lib/luxe-data";

function mockPlaced(
  cropConfig: BeadCropConfigV2,
  slug = "crystal",
  processedImage?: string,
): PlacedBead {
  return {
    position: 0,
    size: { offerKey: "k", sizeMm: 6, label: "6 mm", unitPrice: 1 },
    bead: {
      id: "b1",
      name: "Test",
      beadTypeSlug: slug,
      originalImage: "https://example.com/a.png",
      processedImage: processedImage ?? "https://example.com/processed.png",
      cropConfig,
    } as PlacedBead["bead"],
  };
}

function anchorOnlyConfig(visibleDiameter: number): BeadCropConfigV2 {
  const r = 0.4;
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 1000,
    imageHeight: 1000,
    originalUrl: "https://example.com/a.png",
    processedUrl: "https://example.com/processed.png",
    points: [
      { x: 0.5 - r / 2, y: 0.5 - (visibleDiameter / 1000) / 2 },
      { x: 0.5 + r / 2, y: 0.5 - (visibleDiameter / 1000) / 2 },
      { x: 0.5 + r / 2, y: 0.5 + (visibleDiameter / 1000) / 2 },
      { x: 0.5 - r / 2, y: 0.5 + (visibleDiameter / 1000) / 2 },
    ],
    scale: 1,
    physicalMetrics: {
      visibleWidthPx: visibleDiameter * 0.8,
      visibleHeightPx: visibleDiameter,
      referenceDiameterPx: visibleDiameter,
      processedWidthPx: visibleDiameter + 32,
      processedHeightPx: visibleDiameter + 40,
    },
  };
}

describe("resolveBeadPhysicalMetricsForRender", () => {
  it("uses anchor silhouette with predicted processed export when mask metadata missing", () => {
    const config: BeadCropConfigV2 = {
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: 1000,
      imageHeight: 1000,
      originalUrl: "https://example.com/a.png",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
      scale: 1,
    };
    expect(resolveBeadPhysicalMetrics(config)?.source).toBe("anchorEstimate");
    const render = resolveBeadPhysicalMetricsForRender(config);
    expect(render?.source).toBe("anchorEstimate");
    expect(render?.metrics.processedWidthPx).toBeGreaterThan(0);
    expect(render?.metrics.processedHeightPx).toBeGreaterThan(0);
  });

  it("uses stored physicalMetrics for render", () => {
    const config: BeadCropConfigV2 = {
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: 1000,
      imageHeight: 1000,
      originalUrl: "https://example.com/a.png",
      points: [],
      scale: 1,
      physicalMetrics: {
        visibleWidthPx: 250,
        visibleHeightPx: 248,
        referenceDiameterPx: 250,
        processedWidthPx: 270,
        processedHeightPx: 268,
      },
    };
    expect(resolveBeadPhysicalMetricsForRender(config)?.source).toBe("physicalMetrics");
  });
});

describe("asset-based mm sizing", () => {
  it("same mm maps visible silhouette to target — layout slot matches visible footprint", () => {
    const target = mmToBasePx(6, 1);

    const configA = anchorOnlyConfig(320);
    const configB = anchorOnlyConfig(480);
    const beadA = mockPlaced(configA);
    const beadB = mockPlaced(configB);

    const dimA = getBeadSlotDimensions(beadA, 6, 1);
    const dimB = getBeadSlotDimensions(beadB, 6, 1);

    expect(Math.max(dimA.width, dimA.height)).toBeCloseTo(target, 1);
    expect(Math.max(dimB.width, dimB.height)).toBeCloseTo(target, 1);
  });

  it("maps visible silhouette to target — layout slot excludes export padding", () => {
    const target = mmToBasePx(6, 1);
    const config = anchorOnlyConfig(320);
    const placed = mockPlaced(config);
    const dim = getBeadSlotDimensions(placed, 6, 1);
    const layoutMax = Math.max(dim.width, dim.height);
    const processedMax = Math.max(
      config.physicalMetrics!.processedWidthPx!,
      config.physicalMetrics!.processedHeightPx!,
    );
    expect(layoutMax).toBeCloseTo(target, 1);
    expect(layoutMax).toBeLessThan(target * (processedMax / 320));
  });

  it("same mm renders identical layout diameter regardless of source crop pixel size", () => {
    const beadA = mockPlaced({
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: 1000,
      imageHeight: 1000,
      originalUrl: "https://example.com/a.png",
      points: [],
      scale: 1,
      processedUrl: "https://example.com/pa.png",
      physicalMetrics: {
        visibleWidthPx: 300,
        visibleHeightPx: 300,
        referenceDiameterPx: 300,
        processedWidthPx: 324,
        processedHeightPx: 324,
      },
    });

    const beadB = mockPlaced({
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: 2000,
      imageHeight: 2000,
      originalUrl: "https://example.com/b.png",
      points: [],
      scale: 1,
      processedUrl: "https://example.com/pb.png",
      physicalMetrics: {
        visibleWidthPx: 500,
        visibleHeightPx: 500,
        referenceDiameterPx: 500,
        processedWidthPx: 540,
        processedHeightPx: 540,
      },
    });

    const target = mmToBasePx(6, 1);
    const dimA = getBeadSlotDimensions(beadA, 6, 1);
    const dimB = getBeadSlotDimensions(beadB, 6, 1);

    const maxA = Math.max(dimA.width, dimA.height);
    const maxB = Math.max(dimB.width, dimB.height);
    expect(maxA).toBeCloseTo(maxB, 5);
    expect(maxA).toBeCloseTo(target, 1);
  });

  it("uses mm slot size for processed assets — image scales via object-fit", () => {
    const processed = computeProcessedExportDimensions({ width: 250, height: 200 });
    const placed = mockPlaced(
      {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 800,
        imageHeight: 800,
        originalUrl: "https://example.com/c.png",
        processedUrl: "https://example.com/pc.png",
        points: [],
        scale: 1,
        physicalMetrics: {
          visibleWidthPx: 250,
          visibleHeightPx: 200,
          referenceDiameterPx: 250,
          ...processed,
        },
      },
      "connector",
    );
    expect(usesProcessedStrandAsset(placed.bead)).toBe(true);
    const target = mmToBasePx(8, 1);
    const dim = getBeadSlotDimensions(placed, 8, 1);
    expect(dim.width).toBeCloseTo(dim.height, 5);
    expect(Math.max(dim.width, dim.height)).toBeCloseTo(target, 1);
  });

  it("uses square mm slot for spacer exports — proportions come from the asset", () => {
    const placed = mockPlaced(
      {
        version: BEAD_CROP_CONFIG_V2,
        imageWidth: 1200,
        imageHeight: 2400,
        originalUrl: "https://example.com/spacer.png",
        processedUrl: "https://example.com/spacer-processed.png",
        points: [],
        scale: 1,
        physicalMetrics: {
          visibleWidthPx: 460,
          visibleHeightPx: 1000,
          referenceDiameterPx: 1000,
          processedWidthPx: 500,
          processedHeightPx: 1080,
        },
      },
      "spacer",
    );
    const target = mmToBasePx(6, 1);
    const dim = getBeadSlotDimensions(placed, 6, 1);
    expect(dim.width).toBeCloseTo(dim.height, 5);
    expect(dim.width).toBeCloseTo(target, 1);
  });
});
