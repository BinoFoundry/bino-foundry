import { describe, expect, it } from "vitest";

import { mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "./layout-strand-bead-shells";

describe("occupancy demo gap", () => {
  function chordFor(occ: number, count = 6) {
    const profile = mergeStrandRenderProfile({
      visualScale: 1,
      layoutScale: 1,
      contactWidth: 1,
      contactOffset: occ - 1,
      spacingAdjustment: 0,
      balanceSpacing: false,
      visualSizeScaling: 1,
    });
    const layout = layoutStrandBeadShells({
      centerX: 120,
      centerY: 120,
      radiusPx: 80,
      wristCircumferenceMm: 160,
      balanceSpacing: false,
      beads: Array.from({ length: count }, () => ({
        occupancyMm: 8,
        slotDim: { width: 28, height: 28 },
        profile,
      })),
    });
    const a = layout.beads[0]!;
    const b = layout.beads[1]!;
    const chord = Math.hypot(b.ringX - a.ringX, b.ringY - a.ringY);
    const edgeGap = chord - (a.renderDim.width + b.renderDim.width) / 2;
    return { chord, edgeGap, shellW: a.renderDim.width, contact: layout.contactArcPx[0]! };
  }

  it("shows larger centre spacing at 2.5 than at 1.0", () => {
    const tight = chordFor(1);
    const loose = chordFor(2.5);
    expect(loose.chord).toBeGreaterThan(tight.chord * 1.3);
    expect(loose.shellW).toBeCloseTo(tight.shellW, 3);
  });

  it("packs tighter below 1.0 instead of flooring at the drawn shell", () => {
    const half = chordFor(0.5);
    const one = chordFor(1);
    // This used to assert the opposite — that lowering occupancy below 1 could
    // not pack tighter, because the claim was floored at the shell width. That
    // shell comes from the mm slot, not the artwork, so a narrow piece reserved
    // a full bead of cord and sat in a visible hole. Occupancy below 1 is now
    // honoured, which is the only way a bead cap can sit against its bead.
    expect(half.chord).toBeLessThan(one.chord);
  });
});
