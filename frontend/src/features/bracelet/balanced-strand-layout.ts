/**
 * Balanced angular distribution around the bracelet ring.
 * New items fill the largest arc gap (top → bottom → sides → bisect remaining).
 */

/** Normalised arc positions in [0, 1) for `count` beads on a full circle. */
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

/** Insert index for the next bead so the sequence grows evenly around the ring. */
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
 * Map each sequence index to its balanced angle fraction, assuming beads were
 * added via `findBalancedInsertIndex` in insertion order.
 */
export function balancedFractionsForSequence(count: number): number[] {
  if (count <= 0) return [];
  const order: number[] = [];
  for (let beadIdx = 0; beadIdx < count; beadIdx++) {
    const insertAt = findBalancedInsertIndex(beadIdx);
    order.splice(insertAt, 0, beadIdx);
  }
  const fractions = balancedAngleFractions(count);
  const byIndex = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    byIndex[order[i]!] = fractions[i]!;
  }
  return byIndex;
}
