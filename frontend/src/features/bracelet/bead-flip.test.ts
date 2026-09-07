import { describe, expect, it } from "vitest";

import type { PlacedBead } from "@/lib/luxe-data";

import { toggleBeadFlip } from "./composition";

function piece(position: number, beadTypeId: string, flipped?: boolean): PlacedBead {
  return {
    position,
    bead: { id: `${beadTypeId}-${position}`, beadTypeId } as never,
    size: { sizeMm: 6, unitPrice: 1 } as never,
    ...(flipped ? { flipped: true } : {}),
  };
}

const strand = [piece(0, "cap"), piece(1, "stone"), piece(2, "cap")];

describe("turning a piece around", () => {
  it("turns the chosen piece and leaves its neighbours alone", () => {
    const next = toggleBeadFlip(strand, 0);
    expect(next[0]!.flipped).toBe(true);
    expect(next[1]!.flipped).toBeUndefined();
    expect(next[2]!.flipped).toBeUndefined();
  });

  it("turns it back again", () => {
    const once = toggleBeadFlip(strand, 2);
    expect(once[2]!.flipped).toBe(true);
    expect(toggleBeadFlip(once, 2)[2]!.flipped).toBe(false);
  });

  it("does not mutate the strand it was given", () => {
    const next = toggleBeadFlip(strand, 0);
    expect(strand[0]!.flipped).toBeUndefined();
    expect(next).not.toBe(strand);
  });

  it("keeps the piece's identity, position and price", () => {
    const next = toggleBeadFlip(strand, 1);
    expect(next[1]!.bead.id).toBe(strand[1]!.bead.id);
    expect(next[1]!.position).toBe(1);
    expect(next[1]!.size.unitPrice).toBe(strand[1]!.size.unitPrice);
  });

  it("leaves the strand alone when there is nothing at that index", () => {
    expect(toggleBeadFlip(strand, 9)).toBe(strand);
    expect(toggleBeadFlip([], 0)).toEqual([]);
  });
});
