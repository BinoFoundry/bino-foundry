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

  it("floors packing near visual so 0.5 ≈ 1.0 for edge spacing", () => {
    const half = chordFor(0.5);
    const one = chordFor(1);
    // Lowering below 1 often cannot pack tighter than the drawn shell.
    expect(Math.abs(half.chord - one.chord) / one.chord).toBeLessThan(0.15);
  });
});
