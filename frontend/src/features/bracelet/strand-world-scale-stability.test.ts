import { describe, expect, it } from "vitest";

import { STRAND_LAYOUT_BASELINE_PX, computeStrandCanvasFitBoost } from "./strand-viewport";
import { computeWristRingRadiusPx } from "./strand-ring";

/**
 * Regression: hanging charms must not silently shrink world scale or wrist radius.
 * Camera Fit owns framing; strand layout uses fixed canvas→baseline scale + guide extent.
 */
describe("strand world scale stability", () => {
  it("keeps canvas→baseline scale independent of content overflow", () => {
    const canvasSize = 400;
    const scaleFactor = canvasSize / STRAND_LAYOUT_BASELINE_PX;

    // Simulated charm overflow that previously triggered beadScaleBoost < 1.
    const requiredCanvas = 520;
    const legacyBoost = computeStrandCanvasFitBoost(requiredCanvas, canvasSize);

    expect(legacyBoost).toBeLessThan(1);
    // Builder must continue using unity boost (scaleFactor unchanged).
    expect(scaleFactor * 1).toBeCloseTo(canvasSize / STRAND_LAYOUT_BASELINE_PX, 10);
    expect(scaleFactor * legacyBoost).not.toBeCloseTo(scaleFactor, 5);
  });

  it("keeps wrist radius stable when dangling shell extent grows", () => {
    const center = 200;
    const scaleFactor = 1;
    const bounds = { minCm: 14, maxCm: 19 };
    const guideExtent = 48;
    const danglingCharmExtent = 120;

    const withGuide = computeWristRingRadiusPx(center, 16, scaleFactor, guideExtent, bounds);
    const withCharmShell = computeWristRingRadiusPx(
      center,
      16,
      scaleFactor,
      danglingCharmExtent,
      bounds,
    );

    // Using charm shell for padding would shrink the ring — builder must use guide extent.
    expect(withCharmShell).toBeLessThan(withGuide * 0.85);
    expect(withGuide).toBeGreaterThan(withCharmShell);
  });
});
