import { describe, expect, it } from "vitest";

import {
  calibratedVisualDiameterPx,
  VISUAL_BEAD_BASE_PX,
  VISUAL_BEAD_MAX_PX,
  VISUAL_PX_PER_MM,
} from "./visual-bead-scale";
import { mmToBasePx, STRAND_BEAD_VISUAL_SCALE } from "./strand-bead";
import { GLOBAL_BEAD_RENDER_SCALE } from "./canonical-strand-mm-scale";

const CATALOG_SIZES_MM = [0.1, 0.25, 0.5, 1, 2.5, 4, 6, 8, 10, 12, 15, 20] as const;

describe("calibratedVisualDiameterPx", () => {
  it("scales linearly with mm for mid-range sizes", () => {
    expect(calibratedVisualDiameterPx(2)).toBeCloseTo(VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * 2, 5);
    expect(calibratedVisualDiameterPx(8)).toBeCloseTo(VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * 8, 5);
    expect(calibratedVisualDiameterPx(8) / calibratedVisualDiameterPx(2)).toBeCloseTo(3.31, 1);
  });

  it("preserves strict ordering for any positive decimal mm", () => {
    const px = CATALOG_SIZES_MM.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });

  it("keeps tiny beads visible", () => {
    expect(calibratedVisualDiameterPx(0.1)).toBeGreaterThan(2);
    expect(calibratedVisualDiameterPx(0.1)).toBeLessThan(calibratedVisualDiameterPx(1));
  });

  it("clamps very large beads to the maximum diameter", () => {
    expect(calibratedVisualDiameterPx(40)).toBe(VISUAL_BEAD_MAX_PX);
    expect(calibratedVisualDiameterPx(100)).toBe(VISUAL_BEAD_MAX_PX);
  });

  it("supports arbitrary decimal sizes without breakpoints", () => {
    const samples = [0.11, 0.25, 1, 2.75, 6.5, 14.2];
    const px = samples.map((mm) => calibratedVisualDiameterPx(mm));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]!);
    }
  });
});

describe("mmToBasePx", () => {
  it("scales proportionally with the canvas scale factor", () => {
    const atOne = mmToBasePx(6, 1);
    const atTwo = mmToBasePx(6, 2);
    expect(atTwo / atOne).toBeCloseTo(2, 5);
  });

  it("applies the global visual density multiplier", () => {
    expect(mmToBasePx(8, 1)).toBeCloseTo(
      (VISUAL_BEAD_BASE_PX + VISUAL_PX_PER_MM * 8) * STRAND_BEAD_VISUAL_SCALE * GLOBAL_BEAD_RENDER_SCALE,
      5,
    );
  });
});
