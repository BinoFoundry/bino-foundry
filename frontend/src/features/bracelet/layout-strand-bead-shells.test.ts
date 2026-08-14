import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells, resolveStrandShellFootprint } from "./layout-strand-bead-shells";
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
        slotDim: bead.renderDim,
        profile: { ...profile, layoutScale: 1, visualScale: 1, visualSizeScaling: 1 },
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

  it("contactWidth scales contactArcPx; packing floors at visual shell width", () => {
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: false as const,
    };
    // Small slot so capacity contact arc (not visual shell) dominates packing when width ≥ 1.
    const bead = (contactWidth: number) => ({
      occupancyMm: 8,
      slotDim: { width: 16, height: 16 },
      profile: mergeStrandRenderProfile({ contactWidth, visualScale: 1, layoutScale: 1 }),
    });
    const layout = (contactWidth: number) =>
      layoutStrandBeadShells({
        ...params,
        beads: Array.from({ length: 8 }, () => bead(contactWidth)),
      });

    const tight = layout(0.85);
    const neutral = layout(1);
    const loose = layout(1.15);

    expect(tight.contactArcPx[0]!).toBeLessThan(neutral.contactArcPx[0]! - 0.5);
    expect(loose.contactArcPx[0]!).toBeGreaterThan(neutral.contactArcPx[0]! + 0.5);
    // Packing uses max(contactArc, visualShell) — looser contact still expands occupied arc.
    expect(loose.occupiedArcPx).toBeGreaterThan(neutral.occupiedArcPx + 1);
    // Tighter contact cannot shrink below the visual shell floor (prevents silhouette overlap).
    expect(tight.occupiedArcPx).toBeLessThanOrEqual(neutral.occupiedArcPx + 1e-6);
  });

  it("strand occupancy widens gaps without enlarging the drawn shell", () => {
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: false as const,
    };
    // Small visual slot so contact width (not silhouette) drives packing gaps.
    const bead = (contactWidth: number) => ({
      occupancyMm: 8,
      slotDim: { width: 16, height: 16 },
      profile: mergeStrandRenderProfile({ contactWidth, visualScale: 1, layoutScale: 1 }),
    });
    const neutral = layoutStrandBeadShells({
      ...params,
      beads: Array.from({ length: 6 }, () => bead(1)),
    });
    const loose = layoutStrandBeadShells({
      ...params,
      beads: Array.from({ length: 6 }, () => bead(1.25)),
    });

    expect(loose.occupiedArcPx).toBeGreaterThan(neutral.occupiedArcPx + 1);
    expect(meanShellSize(loose)).toBeCloseTo(meanShellSize(neutral), 4);

    const extreme = resolveStrandShellFootprint({
      occupancyMm: 8,
      slotDim: { width: 28, height: 28 },
      profile: mergeStrandRenderProfile({ contactWidth: 5, visualScale: 1, layoutScale: 1 }),
      contactArcPx: 140,
      naturalContactArcPx: 34,
    });
    const baseline = resolveStrandShellFootprint({
      occupancyMm: 8,
      slotDim: { width: 28, height: 28 },
      profile: mergeStrandRenderProfile({ contactWidth: 1, visualScale: 1, layoutScale: 1 }),
      contactArcPx: 34,
      naturalContactArcPx: 34,
    });
    expect(extreme.packLinearWidth).toBeGreaterThan(baseline.packLinearWidth);
    expect(extreme.renderDim.width).toBeCloseTo(baseline.renderDim.width, 5);
    expect(extreme.renderDim.height).toBeCloseTo(baseline.renderDim.height, 5);
  });

  it("render size scales the drawn shell without changing contact arcs", () => {
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: false as const,
    };
    const bead = (visualScale: number) => ({
      occupancyMm: 8,
      slotDim: { width: 28, height: 28 },
      profile: mergeStrandRenderProfile({ contactWidth: 1, visualScale, layoutScale: 1 }),
    });
    const base = layoutStrandBeadShells({
      ...params,
      beads: Array.from({ length: 6 }, () => bead(1)),
    });
    const bigger = layoutStrandBeadShells({
      ...params,
      beads: Array.from({ length: 6 }, () => bead(1.25)),
    });

    expect(bigger.contactArcPx[0]!).toBeCloseTo(base.contactArcPx[0]!, 5);
    expect(meanShellSize(bigger)).toBeGreaterThan(meanShellSize(base) * 1.2);
  });

  it("render size below 1 shrinks the drawn shell even when contact floor is larger", () => {
    const params = {
      centerX: 120,
      centerY: 120,
      radiusPx: 70,
      wristCircumferenceMm: 160,
      balanceSpacing: false as const,
    };
    const bead = (visualScale: number) => ({
      occupancyMm: 8,
      slotDim: { width: 28, height: 28 },
      profile: mergeStrandRenderProfile({ contactWidth: 1, visualScale, layoutScale: 1 }),
    });
    const full = layoutStrandBeadShells({
      ...params,
      beads: [bead(1)],
    });
    const smaller = layoutStrandBeadShells({
      ...params,
      beads: [bead(0.5)],
    });

    expect(smaller.contactArcPx[0]!).toBeCloseTo(full.contactArcPx[0]!, 5);
    expect(meanShellSize(smaller)).toBeLessThan(meanShellSize(full) * 0.55);
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
