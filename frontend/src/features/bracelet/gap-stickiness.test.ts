import { describe, expect, it } from "vitest";

import { insertionIndexFromLayoutGaps } from "./strand-elastic-layout";

/** Eight evenly spaced gaps, as a strand of eight beads produces. */
const gaps = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
const SPACING = (Math.PI * 2) / 8;

describe("gap stickiness while aiming a drop", () => {
  it("picks the nearest gap when nothing is held yet", () => {
    expect(insertionIndexFromLayoutGaps(gaps[3]! + 0.01, gaps)).toBe(3);
    expect(insertionIndexFromLayoutGaps(gaps[5]! - 0.01, gaps)).toBe(5);
  });

  it("holds the current gap just past the midpoint", () => {
    // The regression: crossing the midpoint by a hair flipped the target, so a
    // hand holding still could rattle between two neighbours.
    const justOver = gaps[3]! + SPACING * 0.55;
    expect(insertionIndexFromLayoutGaps(justOver, gaps)).toBe(4);
    expect(insertionIndexFromLayoutGaps(justOver, gaps, 3)).toBe(3);
  });

  it("gives the gap up once the pointer clearly commits to the next one", () => {
    const wellPast = gaps[3]! + SPACING * 0.95;
    expect(insertionIndexFromLayoutGaps(wellPast, gaps, 3)).toBe(4);
  });

  it("keeps holding while the pointer sits right on the held gap", () => {
    expect(insertionIndexFromLayoutGaps(gaps[6]!, gaps, 6)).toBe(6);
  });

  it("is stable across the 0/2π seam", () => {
    // Gap 0 sits at angle 0; approaching from just below must not jump the ring.
    expect(insertionIndexFromLayoutGaps(-0.01, gaps, 0)).toBe(0);
    expect(insertionIndexFromLayoutGaps(Math.PI * 2 - 0.01, gaps, 0)).toBe(0);
  });

  it("ignores a held index that no longer exists", () => {
    // Beads can be removed mid-drag, shrinking the gap list.
    expect(insertionIndexFromLayoutGaps(gaps[2]!, gaps, 99)).toBe(2);
    expect(insertionIndexFromLayoutGaps(gaps[2]!, gaps, -1)).toBe(2);
  });

  it("still returns 0 when there is nowhere to choose between", () => {
    expect(insertionIndexFromLayoutGaps(1.2, [0], 0)).toBe(0);
    expect(insertionIndexFromLayoutGaps(1.2, [], 0)).toBe(0);
  });
});
