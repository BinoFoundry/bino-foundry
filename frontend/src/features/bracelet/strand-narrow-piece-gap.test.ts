import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells, resolveStrandShellFootprint } from "./layout-strand-bead-shells";
import { STRAND_PATH_START_ANGLE } from "./strand-path";

const slotDim = { width: 30, height: 30 };
const CENTER = 200;
const RADIUS = 150;
/** Arc a full 8mm bead claims on this ring. */
const NATURAL_ARC = 47.1;

const beadProfile = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {});
/** A bead cap: same mm slot, but only 40% of a bead's contact along the cord. */
const narrowProfile = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
  contactWidth: 0.4,
});

function footprint(profile: typeof beadProfile, contactWidth: number) {
  return resolveStrandShellFootprint({
    occupancyMm: 8,
    slotDim,
    profile,
    contactArcPx: NATURAL_ARC * contactWidth,
    naturalContactArcPx: NATURAL_ARC,
  });
}

function centreArcs(layout: ReturnType<typeof layoutStrandBeadShells>): number[] {
  const pts = layout.beads.map((b) => ({
    ang: Math.atan2(b.ringY - CENTER, b.ringX - CENTER),
    r: Math.hypot(b.ringX - CENTER, b.ringY - CENTER),
  }));
  const R = pts.reduce((s, p) => s + p.r, 0) / pts.length;
  const sorted = [...pts].sort((a, b) => a.ang - b.ang);
  return sorted.map((p, i) => {
    const next = sorted[(i + 1) % sorted.length]!;
    let d = next.ang - p.ang;
    if (d < 0) d += 2 * Math.PI;
    return d * R;
  });
}

describe("narrow pieces on the strand", () => {
  it("claims exactly its contact width, not the mm slot it sits in", () => {
    // The regression: packing floored the claim at the shell width, which comes
    // from the mm slot rather than the artwork. A bead cap therefore reserved a
    // whole bead of cord and sat in a visible hole.
    const narrow = footprint(narrowProfile, 0.4);

    expect(narrow.packDiameterPx).toBeCloseTo(NATURAL_ARC * 0.4, 5);
    // Specifically: it must not be floored at the shell.
    expect(narrow.packDiameterPx).toBeLessThan(narrow.visualWidthLinear);
  });

  it("still protects a full-width piece from being overlapped", () => {
    const bead = footprint(beadProfile, 1);
    expect(bead.packDiameterPx).toBeGreaterThanOrEqual(bead.visualWidthLinear);
    expect(bead.packDiameterPx).toBeCloseTo(NATURAL_ARC, 5);
  });

  it("does not shrink what is drawn — only the cord it reserves", () => {
    const narrow = footprint(narrowProfile, 0.4);
    const bead = footprint(beadProfile, 1);
    expect(narrow.renderDim.width).toBeCloseTo(bead.renderDim.width, 5);
  });

  it("seats a narrow piece closer to its neighbours than beads sit to each other", () => {
    const layout = layoutStrandBeadShells({
      centerX: CENTER,
      centerY: CENTER,
      radiusPx: RADIUS,
      wristCircumferenceMm: 160,
      startAngle: STRAND_PATH_START_ANGLE,
      balanceSpacing: true,
      beads: [beadProfile, beadProfile, narrowProfile, beadProfile, beadProfile, beadProfile].map(
        (profile) => ({ occupancyMm: 8, slotDim, profile }),
      ),
    });
    const arcs = centreArcs(layout).sort((a, b) => a - b);
    const beadToBead = arcs[arcs.length - 1]!;

    // Centre spacing drops by half the width saved on each side of the piece.
    const expectedDrop = (NATURAL_ARC - NATURAL_ARC * 0.4) / 2;
    expect(beadToBead - arcs[0]!).toBeCloseTo(expectedDrop, 1);
    expect(beadToBead - arcs[1]!).toBeCloseTo(expectedDrop, 1);
  });

  it("leaves a strand of equal beads evenly spaced", () => {
    const layout = layoutStrandBeadShells({
      centerX: CENTER,
      centerY: CENTER,
      radiusPx: RADIUS,
      wristCircumferenceMm: 160,
      startAngle: STRAND_PATH_START_ANGLE,
      balanceSpacing: true,
      beads: Array.from({ length: 8 }, () => ({ occupancyMm: 8, slotDim, profile: beadProfile })),
    });
    const arcs = centreArcs(layout);
    for (const arc of arcs) expect(arc).toBeCloseTo(arcs[0]!, 6);
  });
});
