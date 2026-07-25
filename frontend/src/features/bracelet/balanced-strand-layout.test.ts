import { describe, expect, it } from "vitest";

import {
  balancedAngleFractions,
  balancedAngularOrder,
  balancedFractionsForSequence,
  findBalancedInsertIndex,
} from "./balanced-strand-layout";

describe("balanced strand layout", () => {
  it("places two beads opposite", () => {
    expect(balancedAngleFractions(2)).toEqual([0, 0.5]);
    expect(findBalancedInsertIndex(1)).toBe(1);
  });

  it("grows top → bottom → right → left for four beads", () => {
    expect(balancedAngleFractions(4)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("maps sequence indices through balanced insertion order with even spacing", () => {
    const fracs = balancedFractionsForSequence(3);
    // Angular order: top → right → bottom → even thirds.
    expect(fracs[0]).toBeCloseTo(0, 5);
    expect(fracs[2]).toBeCloseTo(1 / 3, 5);
    expect(fracs[1]).toBeCloseTo(2 / 3, 5);
  });

  it("redistributes evenly for non-power-of-two counts", () => {
    const fracs = balancedFractionsForSequence(5);
    const sorted = [...fracs].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i]).toBeCloseTo(i / 5, 8);
    }
  });

  it("preserves top → bottom → right → left angular order", () => {
    expect(balancedAngularOrder(4)).toEqual([0, 2, 1, 3]);
  });

  it("returns index 0 for an empty strand", () => {
    expect(findBalancedInsertIndex(0)).toBe(0);
  });
});
