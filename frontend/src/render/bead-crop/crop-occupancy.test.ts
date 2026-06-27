import { describe, expect, it } from "vitest";

import {
  computeCropOccupancyMetrics,
  occupancyAdjustedRenderTarget,
  resolveCropOccupancyRatio,
} from "@bino-foundry/shared/types";

describe("crop occupancy", () => {
  const mask = { x: 100, y: 120, width: 400, height: 380 };
  const processedW = 432;
  const processedH = 412;

  it("computes occupancy from polygon footprint in export space", () => {
    const tight = computeCropOccupancyMetrics(
      [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ],
      1000,
      1000,
      processedW,
      processedH,
      mask,
    );
    expect(tight).not.toBeNull();
    expect(tight!.occupancyRatio).toBeGreaterThan(0.5);
    expect(tight!.occupancyRatio).toBeLessThanOrEqual(1);
  });

  it("boosts render target inversely to occupancy", () => {
    expect(occupancyAdjustedRenderTarget(22.25, 0.65)).toBeCloseTo(22.25 / 0.65, 4);
    expect(occupancyAdjustedRenderTarget(22.25, 1)).toBeCloseTo(22.25, 4);
  });

  it("resolves stored occupancy from physical metrics", () => {
    const ratio = resolveCropOccupancyRatio(
      {
        visibleWidthPx: 400,
        visibleHeightPx: 380,
        referenceDiameterPx: 400,
        occupancyRatio: 0.72,
      },
      null,
    );
    expect(ratio).toBeCloseTo(0.72, 4);
  });
});
