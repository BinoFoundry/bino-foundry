import { describe, expect, it } from "vitest";

import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
} from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "@/features/bracelet/layout-strand-bead-shells";
import { visualSlotDimensions } from "@/features/bracelet/strand-path";
import { layoutDiameterPxForMm } from "@/render/bead-crop/canonical-strand-mm-scale";

/**
 * Visual size scaling compresses rendered diameter jumps without touching occupancy.
 * Regression: CSS shell (renderDim) must follow the curve — not max(contact, visual).
 */
describe("bead size scaling dynamic", () => {
  const slotForMm = (mm: number) => {
    const d = layoutDiameterPxForMm(mm, 1);
    return { width: d, height: d };
  };

  const layoutFor = (mms: number[], visualSizeScaling: number) =>
    layoutStrandBeadShells({
      centerX: 200,
      centerY: 200,
      // Realistic Builder radius — contact arc exceeds linear visual slot (~1.22×).
      radiusPx: 82,
      wristCircumferenceMm: 160,
      beads: mms.map((mm) => ({
        occupancyMm: mm,
        slotDim: slotForMm(mm),
        profile: mergeStrandRenderProfile({
          visualSizeScaling,
          visualScale: 1,
          layoutScale: 1,
        }),
      })),
    });

  it("keeps 6mm visual diameter identical across linear and system curve", () => {
    const dim = slotForMm(6);
    const linear = visualSlotDimensions(
      dim,
      { ...DEFAULT_STRAND_RENDER_PROFILE, visualSizeScaling: 1 },
      6,
    );
    const curved = visualSlotDimensions(
      dim,
      {
        ...DEFAULT_STRAND_RENDER_PROFILE,
        visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
      },
      6,
    );
    expect(curved.width).toBeCloseTo(linear.width, 5);
  });

  it("keeps 6 < 8 < 10 with a subtler progression than linear", () => {
    const profile = mergeStrandRenderProfile({
      visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
      visualScale: 1,
      layoutScale: 1,
    });
    const w = (mm: number) => visualSlotDimensions(slotForMm(mm), profile, mm).width;
    const linear = (mm: number) =>
      visualSlotDimensions(slotForMm(mm), { ...profile, visualSizeScaling: 1 }, mm).width;

    expect(w(6)).toBeLessThan(w(8));
    expect(w(8)).toBeLessThan(w(10));
    expect(w(8) / w(6)).toBeLessThan(linear(8) / linear(6));
    expect(w(10) / w(6)).toBeLessThan(linear(10) / linear(6));
  });

  it("does not change occupancy mm packing inputs when only the curve changes", () => {
    const curved = layoutFor([6, 8, 10], STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT);
    const linear = layoutFor([6, 8, 10], 1);

    expect(curved.contactArcPx).toEqual(linear.contactArcPx);
    expect(curved.occupiedArcPx).toBeCloseTo(linear.occupiedArcPx, 5);
    expect(curved.beads.map((b) => b.occupancyMm)).toEqual([6, 8, 10]);
  });

  it("shrinks 8mm and 10mm CSS shells when visualSizeScaling < 1, keeping 6mm fixed", () => {
    const curved = layoutFor([6, 8, 10], STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT);
    const linear = layoutFor([6, 8, 10], 1);

    const c6 = curved.beads[0]!.renderDim.width;
    const c8 = curved.beads[1]!.renderDim.width;
    const c10 = curved.beads[2]!.renderDim.width;
    const l6 = linear.beads[0]!.renderDim.width;
    const l8 = linear.beads[1]!.renderDim.width;
    const l10 = linear.beads[2]!.renderDim.width;

    // Absolute size at 6mm matches the previous contact-driven render (linear path).
    expect(c6).toBeCloseTo(l6, 4);
    expect(l6).toBeCloseTo(linear.contactArcPx[0]!, 3);

    expect(c8).toBeLessThan(l8 * 0.98);
    expect(c10).toBeLessThan(l10 * 0.95);
    expect(c6).toBeLessThan(c8);
    expect(c8).toBeLessThan(c10);
    expect(c8 / c6).toBeLessThan(l8 / l6);
    expect(c10 / c6).toBeLessThan(l10 / l6);
  });

  it("matches previous contact shell size when visualSizeScaling is linear", () => {
    const linear = layoutFor([6, 8, 10], 1);
    for (let i = 0; i < 3; i++) {
      expect(linear.beads[i]!.renderDim.width).toBeCloseTo(linear.contactArcPx[i]!, 3);
    }
  });
});
