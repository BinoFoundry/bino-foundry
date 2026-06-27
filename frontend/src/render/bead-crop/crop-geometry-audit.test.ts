import { describe, expect, it } from "vitest";

import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";

import {
  normBBoxFromPoints,
  polygonAreaNorm,
  resolveBeadCropGeometryDebug,
} from "./crop-geometry-audit";

describe("crop geometry audit", () => {
  it("computes polygon area and bbox in normalized space", () => {
    const square = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ];
    expect(polygonAreaNorm(square)).toBeCloseTo(0.36, 4);
    const bbox = normBBoxFromPoints(square);
    expect(bbox?.width).toBeCloseTo(0.6, 4);
    expect(bbox?.height).toBeCloseTo(0.6, 4);
  });

  it("reports clip-path vs visible footprint mismatch for loose anchor polygon", () => {
    const config = {
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
      visualBounds: {
        width: 0.5,
        height: 0.5,
        centerX: 0.5,
        centerY: 0.5,
      },
    };

    const geo = resolveBeadCropGeometryDebug(
      config,
      {
        layoutWidthPx: 22.25,
        layoutHeightPx: 22.25,
        imageOffsetPx: { left: 0, top: 0 },
        imageWidthPx: 22.25,
        imageHeightPx: 22.25,
        usesProcessedCanvas: false,
        usesClipPath: true,
        uniformScale: 0.03,
      },
      null,
    );

    expect(geo.cropPolygonAreaPct).toBeCloseTo(64, 0);
    expect(geo.visiblePolygonAreaPct).toBeCloseTo(25, 0);
    expect(geo.clipPathBBoxFillPct).toBeCloseTo(64, 0);
    expect(geo.anchorVsVisibleBBoxDeltaPct).toBeGreaterThan(100);
    expect(geo.clipPathBoundsWidthPx).toBeCloseTo(22.25 * 0.8, 1);
    expect(geo.visibleBoundsPx?.width).toBeCloseTo(22.25 * 0.5, 1);
  });
});
