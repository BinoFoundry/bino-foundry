import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "./layout-strand-bead-shells";
import { calculateBeadRenderTransform } from "./strand-bead-render-transform";
import { STRAND_PATH_START_ANGLE } from "./strand-path";

describe("layoutStrandBeadShells", () => {
  it("produces shell transforms via calculateBeadRenderTransform for each bead", () => {
    const profile = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
      visualScale: 1.1,
      hangOffset: 0.15,
      orientationMode: "outward",
    });
    const slotDim = { width: 30, height: 30 };
    const center = 130;
    const radiusPx = 70;

    const layout = layoutStrandBeadShells({
      centerX: center,
      centerY: center,
      radiusPx,
      wristCircumferenceMm: 50,
      startAngle: STRAND_PATH_START_ANGLE,
      balanceSpacing: true,
      beads: Array.from({ length: 4 }, () => ({
        occupancyMm: 8,
        slotDim,
        profile,
      })),
    });

    expect(layout.beads).toHaveLength(4);
    for (const bead of layout.beads) {
      const direct = calculateBeadRenderTransform({
        ringX: bead.ringX,
        ringY: bead.ringY,
        angleRad: bead.angleRad,
        slotDim,
        profile,
      });
      expect(bead.shellLeft).toBeCloseTo(direct.shellLeft, 8);
      expect(bead.shellTop).toBeCloseTo(direct.shellTop, 8);
      expect(bead.rotationDeg).toBeCloseTo(direct.rotationDeg, 8);
      expect(bead.cssTransform).toBe(direct.cssTransform);
      expect(bead.cssTransformOrigin).toBe(direct.cssTransformOrigin);
    }
  });

  it("places first bead near the top of the ring (Builder start angle)", () => {
    const layout = layoutStrandBeadShells({
      centerX: 100,
      centerY: 100,
      radiusPx: 60,
      wristCircumferenceMm: 48,
      beads: Array.from({ length: 3 }, () => ({
        occupancyMm: 8,
        slotDim: { width: 24, height: 24 },
        profile: DEFAULT_STRAND_RENDER_PROFILE,
      })),
    });
    const first = layout.beads[0]!;
    // Top of screen-space ring is near angle -π/2 → y < center.
    expect(first.ringY).toBeLessThan(100);
  });
});
