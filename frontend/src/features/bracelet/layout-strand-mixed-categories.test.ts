import { describe, expect, it } from "vitest";

import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

import {
  layoutStrandBeadShells,
  resolveStrandShellFootprint,
} from "./layout-strand-bead-shells";
import { layoutDiameterPxForMm } from "@/render/bead-crop/canonical-strand-mm-scale";

/** Profile fixtures — mirror production type defaults without slug branching in the layout code. */
const PROFILES = {
  crystal: mergeStrandRenderProfile({
    layoutMode: "inline",
    contactWidth: 1,
    visualScale: 1,
    forceRoundFootprint: true,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
  charm: mergeStrandRenderProfile({
    layoutMode: "dangling",
    contactWidth: 1,
    visualScale: 1,
    hangOffset: 0.12,
    anchorPreset: "loop",
    anchorX: 0.5,
    anchorY: 0.08,
    forceRoundFootprint: false,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
  spacer: mergeStrandRenderProfile({
    layoutMode: "inline",
    contactWidth: 1,
    visualScale: 1,
    forceRoundFootprint: false,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
  connector: mergeStrandRenderProfile({
    layoutMode: "inline",
    contactWidth: 0.2,
    visualScale: 1,
    forceRoundFootprint: false,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
  separator: mergeStrandRenderProfile({
    layoutMode: "inline",
    contactWidth: 1,
    visualScale: 1,
    preferStrandImageUrl: true,
    forceRoundFootprint: false,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
  accent: mergeStrandRenderProfile({
    layoutMode: "inline",
    contactWidth: 1,
    visualScale: 1,
    forceRoundFootprint: true,
    visualSizeScaling: STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT,
  }),
} as const satisfies Record<string, StrandRenderProfile>;

function slotForMm(mm: number, aspect: { w?: number; h?: number } = {}) {
  const d = layoutDiameterPxForMm(mm, 1);
  return { width: d * (aspect.w ?? 1), height: d * (aspect.h ?? 1) };
}

/** Tall dangling charm shell (content taller than mm square). */
function danglingCharmSlot(mm: number) {
  const d = layoutDiameterPxForMm(mm, 1);
  return { width: d, height: d * 1.85 };
}

describe("mixed category strand shells", () => {
  it("lays out Crystal + Charm + Spacer + Connector without collapsing occupancy", () => {
    const beads = [
      { occupancyMm: 6, slotDim: slotForMm(6), profile: PROFILES.crystal },
      { occupancyMm: 8, slotDim: danglingCharmSlot(8), profile: PROFILES.charm },
      { occupancyMm: 4, slotDim: slotForMm(4), profile: PROFILES.spacer },
      { occupancyMm: 6, slotDim: slotForMm(6, { w: 0.45, h: 0.45 }), profile: PROFILES.connector },
      { occupancyMm: 8, slotDim: slotForMm(8), profile: PROFILES.crystal },
      { occupancyMm: 10, slotDim: slotForMm(10), profile: PROFILES.accent },
      { occupancyMm: 6, slotDim: slotForMm(6), profile: PROFILES.separator },
    ];

    const layout = layoutStrandBeadShells({
      centerX: 200,
      centerY: 200,
      radiusPx: 82,
      wristCircumferenceMm: 160,
      beads,
    });

    expect(layout.beads).toHaveLength(7);
    expect(layout.contactArcPx).toHaveLength(7);
    expect(layout.occupiedArcPx).toBeGreaterThan(0);

    // Charm dangling: hang attach near the top of the shell (hanging ring), not centre.
    const charm = layout.beads[1]!;
    expect(charm.transformOriginY).toBeLessThan(charm.renderDim.height * 0.25);

    // Connector with narrow contact still gets a positive shell.
    expect(layout.beads[3]!.renderDim.width).toBeGreaterThan(1);

    // Strict size progression on crystal-like inline items at 6 < 8 < 10.
    const c6 = layout.beads[0]!.renderDim.width;
    const c8Accent = layout.beads[5]!.renderDim.width;
    expect(c6).toBeLessThan(layout.beads[4]!.renderDim.width);
    expect(layout.beads[4]!.renderDim.width).toBeLessThan(c8Accent);
  });

  it("keeps charm absolute size at 6mm when curve is applied; softens 10mm charm", () => {
    const make = (mm: number, scaling: number) =>
      layoutStrandBeadShells({
        centerX: 200,
        centerY: 200,
        radiusPx: 82,
        wristCircumferenceMm: 160,
        beads: [
          {
            occupancyMm: mm,
            slotDim: danglingCharmSlot(mm),
            profile: mergeStrandRenderProfile(PROFILES.charm, { visualSizeScaling: scaling }),
          },
        ],
      }).beads[0]!;

    const linear6 = make(6, 1);
    const curved6 = make(6, STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT);
    const linear10 = make(10, 1);
    const curved10 = make(10, STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT);

    expect(curved6.renderDim.width).toBeCloseTo(linear6.renderDim.width, 4);
    expect(curved6.renderDim.height).toBeCloseTo(linear6.renderDim.height, 4);
    expect(curved10.renderDim.width).toBeLessThan(linear10.renderDim.width * 0.95);
    expect(curved10.renderDim.height).toBeLessThan(linear10.renderDim.height * 0.95);
    expect(curved10.renderDim.height).toBeGreaterThan(curved6.renderDim.height);
  });

  it("preserves dangling aspect ratio when the size curve is applied", () => {
    const footprint = resolveStrandShellFootprint({
      occupancyMm: 10,
      slotDim: danglingCharmSlot(10),
      profile: PROFILES.charm,
      contactArcPx: 48,
      naturalContactArcPx: 20,
    });
    const renderAspect = footprint.renderDim.height / footprint.renderDim.width;
    const linearAspect =
      Math.max(footprint.renderDim.width / footprint.curveFactor, footprint.visualHeightLinear) /
      Math.max(20, footprint.visualWidthLinear);
    expect(renderAspect).toBeCloseTo(linearAspect, 5);
    expect(footprint.curveFactor).toBeLessThan(1);
    // Tuned contact may exceed natural for packing without stretching the drawn shell.
    expect(footprint.packLinearWidth).toBeGreaterThan(20);
    expect(footprint.renderDim.width).toBeCloseTo(
      Math.max(20, footprint.visualWidthLinear) * footprint.curveFactor,
      5,
    );
  });

  it("does not change contact arcs across categories when only the curve changes", () => {
    const beadsCurved = [
      { occupancyMm: 8, slotDim: slotForMm(8), profile: PROFILES.crystal },
      { occupancyMm: 8, slotDim: danglingCharmSlot(8), profile: PROFILES.charm },
      { occupancyMm: 8, slotDim: slotForMm(8), profile: PROFILES.spacer },
      { occupancyMm: 8, slotDim: slotForMm(8), profile: PROFILES.connector },
    ];
    const beadsLinear = beadsCurved.map((b) => ({
      ...b,
      profile: mergeStrandRenderProfile(b.profile, { visualSizeScaling: 1 }),
    }));

    const curved = layoutStrandBeadShells({
      centerX: 200,
      centerY: 200,
      radiusPx: 82,
      wristCircumferenceMm: 160,
      beads: beadsCurved,
    });
    const linear = layoutStrandBeadShells({
      centerX: 200,
      centerY: 200,
      radiusPx: 82,
      wristCircumferenceMm: 160,
      beads: beadsLinear,
    });

    expect(curved.contactArcPx).toEqual(linear.contactArcPx);
    expect(curved.occupiedArcPx).toBeCloseTo(linear.occupiedArcPx, 5);
  });

  it("matches natural-contact shell for every category when visualSizeScaling is 1", () => {
    for (const [name, profile] of Object.entries(PROFILES)) {
      const mm = 8;
      const slotDim =
        name === "charm" ? danglingCharmSlot(mm) : slotForMm(mm);
      const linearProfile = mergeStrandRenderProfile(profile, { visualSizeScaling: 1 });
      const layout = layoutStrandBeadShells({
        centerX: 180,
        centerY: 180,
        radiusPx: 82,
        wristCircumferenceMm: 160,
        beads: [{ occupancyMm: mm, slotDim, profile: linearProfile }],
      });
      const bead = layout.beads[0]!;
      // Neutral occupancy profile (width 1) — matches what layout uses for drawn size.
      const neutralProfile = mergeStrandRenderProfile(linearProfile, {
        contactWidth: 1,
        contactOffset: 0,
        spacingAdjustment: 0,
      });
      const neutralLayout = layoutStrandBeadShells({
        centerX: 180,
        centerY: 180,
        radiusPx: 82,
        wristCircumferenceMm: 160,
        beads: [{ occupancyMm: mm, slotDim, profile: neutralProfile }],
      });
      // Drawn size follows neutral contact, not the category's tuned occupancy (e.g. connector 0.2).
      expect(bead.renderDim.width, name).toBeCloseTo(neutralLayout.beads[0]!.renderDim.width, 5);
      expect(bead.renderDim.height, name).toBeCloseTo(neutralLayout.beads[0]!.renderDim.height, 5);
    }
  });

  it("keeps default profile layoutMode inline (non-charm categories)", () => {
    expect(DEFAULT_STRAND_RENDER_PROFILE.layoutMode).toBe("inline");
    expect(PROFILES.charm.layoutMode).toBe("dangling");
    expect(PROFILES.connector.layoutMode).toBe("inline");
  });
});
