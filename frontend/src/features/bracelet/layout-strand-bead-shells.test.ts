import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "./layout-strand-bead-shells";
import { calculateBeadRenderTransform } from "./strand-bead-render-transform";
import { STRAND_PATH_START_ANGLE } from "./strand-path";

function meanShellSize(layout: ReturnType<typeof layoutStrandBeadShells>): number {
  const sizes = layout.beads.map((b) => (b.renderDim.width + b.renderDim.height) / 2);
  return sizes.reduce((s, n) => s + n, 0) / Math.max(sizes.length, 1);
}

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

  it("layoutScale changes rendered shell size", () => {
    const base = layoutStrandBeadShells({
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      beads: Array.from({ length: 8 }, () => ({
        occupancyMm: 8,
        slotDim: { width: 28, height: 28 },
        profile: DEFAULT_STRAND_RENDER_PROFILE,
      })),
    });
    const larger = layoutStrandBeadShells({
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      beads: Array.from({ length: 8 }, () => ({
        occupancyMm: 8,
        slotDim: { width: 28, height: 28 },
        profile: mergeStrandRenderProfile({ layoutScale: 1.1 }),
      })),
    });
    expect(meanShellSize(larger)).toBeGreaterThan(meanShellSize(base) + 1);
  });

  it("contactWidth packs beads tighter when below 1 and looser when above 1", () => {
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: false as const,
    };
    const bead = (contactWidth: number) => ({
      occupancyMm: 8,
      slotDim: { width: 28, height: 28 },
      profile: mergeStrandRenderProfile({ contactWidth }),
    });
    // Contiguous packing makes contact width change neighbour centre distance directly.
    const layout = (contactWidth: number) =>
      layoutStrandBeadShells({
        ...params,
        beads: Array.from({ length: 8 }, () => bead(contactWidth)),
      });

    // Force physical-contact path by packing under capacity with balance off — use
    // occupied arc + per-bead contactArc which both flow from contactWidth.
    const tight = layout(0.85);
    const neutral = layout(1);
    const loose = layout(1.15);

    expect(tight.contactArcPx[0]!).toBeLessThan(neutral.contactArcPx[0]! - 0.5);
    expect(loose.contactArcPx[0]!).toBeGreaterThan(neutral.contactArcPx[0]! + 0.5);
    expect(tight.occupiedArcPx).toBeLessThan(neutral.occupiedArcPx - 1);
    expect(loose.occupiedArcPx).toBeGreaterThan(neutral.occupiedArcPx + 1);
  });

  it("keeps clockwise neighbour order equal to array order when a bead is added", () => {
    const profile = DEFAULT_STRAND_RENDER_PROFILE;
    const slotDim = { width: 28, height: 28 };
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: true as const,
    };
    const bead = () => ({ occupancyMm: 8, slotDim, profile });

    const two = layoutStrandBeadShells({
      ...params,
      beads: [bead(), bead()],
    });
    const three = layoutStrandBeadShells({
      ...params,
      beads: [bead(), bead(), bead()],
    });

    const clockwiseOrder = (layout: typeof two) => {
      const start = layout.beads[0]!.angleRad;
      return [...layout.beads]
        .sort((a, b) => {
          const da = ((a.angleRad - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const db = ((b.angleRad - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          return da - db;
        })
        .map((b) => b.index);
    };

    expect(clockwiseOrder(two)).toEqual([0, 1]);
    expect(clockwiseOrder(three)).toEqual([0, 1, 2]);
    // First bead stays anchored; we never jump to Top/Bottom/Right largest-gap anchors.
    expect(three.beads[0]!.angleRad).toBeCloseTo(two.beads[0]!.angleRad, 5);
  });
});
