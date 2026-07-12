import { describe, expect, it } from "vitest";

import { getGuideSlotDimensions } from "@/render/bead-crop";
import { STRAND_LAYOUT_BASELINE_PX, STRAND_CONTENT_PADDING_PX, STRAND_RING_EDGE_PADDING_PX, computeStrandContentBounds, squareCanvasSizeForBounds } from "./strand-viewport";

import {
  computeStrandRingStrokePx,
  computeWristRingRadiusPx,
  wristSizeBoundsFromCatalog,
} from "./strand-ring";

const BOUNDS = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19, 20]);

function emptyGuideRequiredCanvas(canvasSize: number, wristSizeCm: number, guideSizeMm = 8): number {
  const center = canvasSize / 2;
  const scaleFactor = canvasSize / STRAND_LAYOUT_BASELINE_PX;
  const guideSlotDim = getGuideSlotDimensions(scaleFactor, guideSizeMm);
  const maxExtent = Math.max(guideSlotDim.width, guideSlotDim.height);
  const ringStrokeHalf = computeStrandRingStrokePx(scaleFactor) / 2;
  const radius = computeWristRingRadiusPx(center, wristSizeCm, scaleFactor, maxExtent, BOUNDS, ringStrokeHalf);
  const edgePad = STRAND_RING_EDGE_PADDING_PX * scaleFactor + STRAND_CONTENT_PADDING_PX;
  const bounds = computeStrandContentBounds([], radius, center, ringStrokeHalf);
  return squareCanvasSizeForBounds(bounds, edgePad);
}

describe("computeWristRingRadiusPx", () => {
  it("returns distinct radii for every cm in the catalogue range", () => {
    const center = 200;
    const extent = 40;
    const scale = 1;
    const radii = [14, 15, 16, 17, 18, 19].map((cm) =>
      computeWristRingRadiusPx(center, cm, scale, extent, BOUNDS),
    );
    const unique = new Set(radii.map((r) => r.toFixed(4)));
    expect(unique.size).toBe(6);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThan(radii[i - 1]!);
    }
  });

  it("scales with future admin-added sizes automatically", () => {
    const bounds = wristSizeBoundsFromCatalog([12, 14, 16, 20, 22]);
    const small = computeWristRingRadiusPx(200, 12, 1, 40, bounds);
    const large = computeWristRingRadiusPx(200, 22, 1, 40, bounds);
    expect(small).toBeLessThan(large);
  });

  it("keeps empty guide ring inside the layout canvas for every wrist size", () => {
    const canvasSizes = [360, 420, 500, 640, 920];
    const wristSizes = [14, 15, 16, 17, 18, 19, 20];

    for (const canvasSize of canvasSizes) {
      for (const wristSizeCm of wristSizes) {
        expect(emptyGuideRequiredCanvas(canvasSize, wristSizeCm)).toBeLessThanOrEqual(canvasSize);
      }
    }
  });
});
