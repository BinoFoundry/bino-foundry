import { calculateBeadCount, type PlacedBead } from "@/lib/luxe-data";

/** Keep only beads that still fit the strand after wrist/size changes. */
export function prunePlacedBeads(placed: PlacedBead[], capacity: number): PlacedBead[] {
  return placed
    .filter((b) => b.position >= 0 && b.position < capacity)
    .sort((a, b) => a.position - b.position);
}

export function strandCapacity(wristSizeCm: number, beadSizeMm: number): number {
  return calculateBeadCount(wristSizeCm, beadSizeMm);
}

/** When bead size changes, update all placed beads to the new default mm. */
export function remapPlacedBeadSizes(placed: PlacedBead[], beadSizeMm: number): PlacedBead[] {
  return placed.map((b) => ({ ...b, beadSize: beadSizeMm }));
}
