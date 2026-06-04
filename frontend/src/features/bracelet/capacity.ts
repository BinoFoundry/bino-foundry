import { calculateBeadCount, type PlacedBead } from "@/lib/luxe-data";

/**
 * Strand slot capacity from wrist circumference and bead diameter.
 *
 * Formula: `round((wristCm × 10) / beadMm)` with a minimum of 8 slots.
 * Example: 16 cm wrist, 8 mm beads → 20 slots; same wrist at 10 mm → 16 slots.
 *
 * @see calculateBeadCount in `@/lib/luxe-data`
 */
export function strandCapacity(wristSizeCm: number, beadSizeMm: number): number {
  return calculateBeadCount(wristSizeCm, beadSizeMm);
}

/** Keep only beads whose slot index is still valid after wrist/size changes. */
export function prunePlacedBeads(placed: PlacedBead[], capacity: number): PlacedBead[] {
  return placed
    .filter((b) => b.position >= 0 && b.position < capacity)
    .sort((a, b) => a.position - b.position);
}

/** Count beads dropped when shrinking capacity (for user feedback). */
export function countPrunedBeads(placed: PlacedBead[], capacity: number): number {
  return placed.length - prunePlacedBeads(placed, capacity).length;
}

/** When bead size changes, update all placed beads to the new default mm. */
export function remapPlacedBeadSizes(placed: PlacedBead[], beadSizeMm: number): PlacedBead[] {
  return placed.map((b) => ({ ...b, beadSize: beadSizeMm }));
}
