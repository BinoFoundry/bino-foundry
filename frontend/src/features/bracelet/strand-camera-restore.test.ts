import { describe, expect, it } from "vitest";

import {
  computeLayoutFitScale,
  computeStrandViewScale,
  computeTwinPreviewScale,
} from "./strand-viewport";

/** Mirrors useStrandZoom restore logic after a matching-pair cycle. */
function simulateTwinToggleRestore(params: {
  userZoom: number;
  singleFit: number;
  twinFit: number;
  containerWidth: number;
  layoutCanvas: number;
}) {
  const { userZoom, singleFit, layoutCanvas } = params;
  const twinPreview = computeTwinPreviewScale(
    singleFit,
    Math.min(singleFit, Math.max(0, (params.containerWidth - 12) / (2 * layoutCanvas))),
  );

  const viewScaleBefore = computeStrandViewScale({
    autoFitScale: singleFit,
    userZoom,
    twinPreviewScale: 1,
  });

  computeStrandViewScale({
    autoFitScale: singleFit,
    userZoom,
    twinPreviewScale: twinPreview,
  });

  const fitAfterExit = computeLayoutFitScale({
    autoFitScale: singleFit,
    twinPreviewScale: 1,
  });
  const restoredUserZoom = viewScaleBefore / fitAfterExit;

  return computeStrandViewScale({
    autoFitScale: singleFit,
    userZoom: restoredUserZoom,
    twinPreviewScale: 1,
  });
}

describe("matching pair camera restore", () => {
  it("restores the exact single-strand view scale after a toggle cycle", () => {
    const before = computeStrandViewScale({
      autoFitScale: 1,
      userZoom: 1.56,
      twinPreviewScale: 1,
    });
    const after = simulateTwinToggleRestore({
      userZoom: 1.56,
      singleFit: 1,
      twinFit: 0.74,
      containerWidth: 900,
      layoutCanvas: 500,
    });
    expect(after).toBeCloseTo(before, 8);
  });

  it("does not drift after 20 toggle cycles", () => {
    const before = computeStrandViewScale({
      autoFitScale: 0.95,
      userZoom: 1.56,
      twinPreviewScale: 1,
    });
    let userZoom = 1.56;
    for (let i = 0; i < 20; i += 1) {
      const restored = simulateTwinToggleRestore({
        userZoom,
        singleFit: 0.95,
        twinFit: 0.7,
        containerWidth: 900,
        layoutCanvas: 500,
      });
      expect(restored).toBeCloseTo(before, 8);
      userZoom = (restored / 0.95);
    }
  });
});
