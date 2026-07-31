/**
 * Balanced insertion order around the bracelet ring.
 *
 * Insertion order (unchanged): fill the largest arc gap
 *   top → bottom → right → left → bisect remaining gaps …
 *
 * This module retains the theoretical slot helpers used by legacy callers and tests.
 * Live Bracelet Builder placement uses physical-contact packing in
 * `computeBalancedRadialStrandPathLayout` (edge-to-edge; leftover = one empty arc).
 * Legacy largest-gap helpers below remain for tests and opt-in aesthetics.
 */

/** Theoretical largest-gap bisection points (sorted). Used only to decide insert slots. */
export function balancedAngleFractions(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const fractions = [0, 0.5];
  for (let k = 3; k <= count; k++) {
    const sorted = [...fractions].sort((a, b) => a - b);
    let bestGap = -1;
    let bestMid = 0;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const b = sorted[(i + 1) % sorted.length]!;
      const gap = i === sorted.length - 1 ? 1 - a + b : b - a;
      if (gap > bestGap + 1e-12) {
        bestGap = gap;
        bestMid = (a + gap / 2) % 1;
      }
    }
    fractions.push(bestMid);
  }
  return fractions.sort((a, b) => a - b);
}

/**
 * Insert index into the current angular order for the next bead.
 * Preserves top → bottom → sides → diagonal fill priority.
 */
export function findBalancedInsertIndex(currentCount: number): number {
  if (currentCount <= 0) return 0;
  const before = balancedAngleFractions(currentCount);
  const after = balancedAngleFractions(currentCount + 1);
  const beforeKeys = new Set(before.map((f) => f.toFixed(8)));
  const newFrac = after.find((f) => !beforeKeys.has(f.toFixed(8)));
  if (newFrac === undefined) return currentCount;
  return after.filter((f) => f < newFrac - 1e-9).length;
}

/**
 * Angular order of chronological bead indices (ring order from startAngle).
 * Built by repeatedly inserting into the largest theoretical gap.
 */
export function balancedAngularOrder(count: number): number[] {
  if (count <= 0) return [];
  const order: number[] = [];
  for (let beadIdx = 0; beadIdx < count; beadIdx++) {
    const insertAt = findBalancedInsertIndex(beadIdx);
    order.splice(insertAt, 0, beadIdx);
  }
  return order;
}

/**
 * Map each chronological sequence index to an even angle fraction in [0, 1).
 *
 * Useful for tests / legacy even-slot math. Live strand positions do not use these
 * equal-angle fractions.
 */
export function balancedFractionsForSequence(count: number): number[] {
  if (count <= 0) return [];
  const order = balancedAngularOrder(count);
  const byIndex = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    byIndex[order[i]!] = i / count;
  }
  return byIndex;
}
