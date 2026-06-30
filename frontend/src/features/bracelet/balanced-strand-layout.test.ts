import { describe, expect, it } from "vitest";

import {
  balancedAngleFractions,
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

  it("maps sequence indices through balanced insertion order", () => {
    const fracs = balancedFractionsForSequence(3);
    expect(fracs[0]).toBeCloseTo(0, 5);
    expect(fracs[1]).toBeCloseTo(0.5, 5);
    expect(fracs[2]).toBeCloseTo(0.25, 5);
  });

  it("returns index 0 for an empty strand", () => {
    expect(findBalancedInsertIndex(0)).toBe(0);
  });
});
