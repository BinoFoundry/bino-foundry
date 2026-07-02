import type { PlacedBead } from "@/lib/luxe-data";

import { normalizeFromSlots, normalizeSequence } from "./composition";

/**
 * Swap two beads by dense array index.
 * Only exchanges the two entries; neighbours keep the same indices.
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

  const next = sorted.slice();
  const fromBead = next[fromPosition]!;
  const toBead = next[toPosition]!;
  next[fromPosition] = toBead.position === fromPosition ? toBead : { ...toBead, position: fromPosition };
  next[toPosition] = fromBead.position === toPosition ? fromBead : { ...fromBead, position: toPosition };
  return normalizeSequence(next);
}

/** @deprecated Use {@link swapPlacedBeads}. */
export const movePlacedBead = swapPlacedBeads;

export function logBraceletReorderSwap(
  before: PlacedBead[],
  fromPosition: number,
  toPosition: number,
  after: PlacedBead[],
): void {
  if (!import.meta.env.DEV) return;
  const sorted = normalizeFromSlots(before);
  console.info("[bracelet-reorder]", {
    sourceIndex: fromPosition,
    sourceBeadId: sorted[fromPosition]?.bead.id ?? null,
    targetIndex: toPosition,
    targetBeadId: sorted[toPosition]?.bead.id ?? null,
    resultingArray: normalizeFromSlots(after).map((b) => b.bead.id),
  });
}
