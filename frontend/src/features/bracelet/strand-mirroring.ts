import type { PlacedBead } from "@/lib/luxe-data";

/**
 * Should the piece at `index` be flipped along the cord?
 *
 * An asymmetric piece — a bead cap — should open toward the bead it sits
 * against, so a single uploaded image serves both sides. The rule reads the
 * sequence rather than the artwork: a bead before it and none after means the
 * piece faces backwards and must mirror.
 *
 * The strand is a closed loop, so neighbours wrap around.
 *
 * Ambiguous arrangements — beads on both sides, or on neither — keep the
 * uploaded orientation. There is no correct answer there, and guessing would
 * make the result look arbitrary as the customer reorders the strand.
 */
export function shouldMirrorTowardNeighbour(placed: PlacedBead[], index: number): boolean {
  const count = placed.length;
  if (count < 2 || index < 0 || index >= count) return false;

  const self = placed[index];
  const previous = placed[(index - 1 + count) % count];
  const next = placed[(index + 1) % count];

  // "A bead" means anything of a different kind from this piece: a run of caps
  // side by side has no bead to face, and neither does a lone piece.
  const isBead = (other: PlacedBead) => other.bead.beadTypeId !== self.bead.beadTypeId;

  const beadBefore = previous !== self && isBead(previous);
  const beadAfter = next !== self && isBead(next);

  return beadBefore && !beadAfter;
}
