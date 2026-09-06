import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { shouldMirrorTowardNeighbour } from "./strand-mirroring";

function piece(position: number, beadTypeId: string): PlacedBead {
  return {
    position,
    bead: { id: `${beadTypeId}-${position}`, beadTypeId } as never,
    size: { sizeMm: 8, unitPrice: 1 } as never,
  };
}

/** cap · bead · bead · cap around a closed loop. */
const strand = [piece(0, "cap"), piece(1, "stone"), piece(2, "stone"), piece(3, "cap")];

describe("shouldMirrorTowardNeighbour", () => {
  it("keeps the uploaded orientation when the bead comes after", () => {
    expect(shouldMirrorTowardNeighbour(strand, 0)).toBe(false);
  });

  it("mirrors when the bead comes before", () => {
    // Last slot wraps to the first, which is a cap — so only the stone at
    // index 2 counts, and this cap must turn to face it.
    expect(shouldMirrorTowardNeighbour(strand, 3)).toBe(true);
  });

  it("mirrors a cap that trails a bead with a cap behind it", () => {
    // cap · bead · cap — the last cap has a bead before and a cap after.
    const s = [piece(0, "cap"), piece(1, "stone"), piece(2, "cap"), piece(3, "cap")];
    expect(shouldMirrorTowardNeighbour(s, 2)).toBe(true);
  });

  it("leaves a cap between two beads alone — either way is defensible", () => {
    const s = [piece(0, "stone"), piece(1, "cap"), piece(2, "stone"), piece(3, "stone")];
    expect(shouldMirrorTowardNeighbour(s, 1)).toBe(false);
  });

  it("leaves a run of caps alone — there is no bead to face", () => {
    const s = [piece(0, "cap"), piece(1, "cap"), piece(2, "cap")];
    expect(shouldMirrorTowardNeighbour(s, 1)).toBe(false);
  });

  it("does nothing on a strand too short to have neighbours", () => {
    expect(shouldMirrorTowardNeighbour([piece(0, "cap")], 0)).toBe(false);
    expect(shouldMirrorTowardNeighbour([], 0)).toBe(false);
  });

  it("ignores an index outside the strand", () => {
    expect(shouldMirrorTowardNeighbour(strand, 9)).toBe(false);
    expect(shouldMirrorTowardNeighbour(strand, -1)).toBe(false);
  });
});
