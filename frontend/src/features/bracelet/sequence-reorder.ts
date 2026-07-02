import type { PlacedBead } from "@/lib/luxe-data";

import { normalizeFromSlots, normalizeSequence } from "./composition";

/**
 * Swap two beads by display index.
 * Only the two affected positions change; the rest of the sequence stays put.
 */
export function swapPlacedBeads(
  placed: PlacedBead[],
  fromPosition: number,
  toPosition: number,
): PlacedBead[] {
  const sorted = normalizeFromSlots(placed);
  if (fromPosition < 0 || fromPosition >= sorted.length) return sorted;
  if (toPosition < 0 || toPosition >= sorted.length) return sorted;
  if (fromPosition === toPosition) return sorted;

  const next = [...sorted];
  const fromBead = next[fromPosition]!;
  const toBead = next[toPosition]!;
  next[fromPosition] = { ...toBead, position: fromPosition };
  next[toPosition] = { ...fromBead, position: toPosition };
  return normalizeSequence(next);
}

/** @deprecated Use {@link swapPlacedBeads} — kept as alias for existing imports. */
export const movePlacedBead = swapPlacedBeads;
