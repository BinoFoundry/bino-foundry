import type { PlacedBead } from "@/lib/luxe-data";

import { normalizeSequence } from "./composition";

/**
 * Reorder a bead within the dense sequence.
 * `toPosition` is a display index (bead index or trailing insertion slot).
 */
export function movePlacedBead(
  placed: PlacedBead[],
  fromPosition: number,
  toPosition: number,
): PlacedBead[] {
  const sorted = normalizeSequence(placed);
  if (fromPosition < 0 || fromPosition >= sorted.length) return sorted;
  if (fromPosition === toPosition) return sorted;

  const next = [...sorted];
  const [item] = next.splice(fromPosition, 1);
  if (!item) return sorted;
  const insertAt = Math.max(0, Math.min(toPosition, next.length));
  next.splice(insertAt, 0, item);
  return normalizeSequence(next);
}
