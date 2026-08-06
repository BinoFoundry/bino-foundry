/**
 * Resolves which strand receives the next automatic bead insertion in matching pair mode.
 * Manual drag/drop bypasses this module entirely.
 */

import type { PlacedBead } from "@/lib/luxe-data";

import { canPlaceBeadSize } from "./capacity";

export type MatchingPairMirrorMode = "sequential" | "mirror";

export type StrandId = "A" | "B";

export interface ResolveAutoPlacementInput {
  twinning: boolean;
  wristSizeA: number;
  wristSizeB: number;
  placedA: PlacedBead[];
  placedB: PlacedBead[];
  beadSizeMm: number;
  /** `sequential` fills A then B; `mirror` places on both (future). */
  mirrorMode?: MatchingPairMirrorMode;
  /** When set, prefer this strand if it has capacity (independent matching-pair editing). */
  preferredStrand?: StrandId;
}

/**
 * Returns the strand that should receive the next library click insertion.
 * `null` when neither strand can accept the bead.
 */
export function resolveAutoPlacementStrand(input: ResolveAutoPlacementInput): StrandId | null {
  const {
    twinning,
    wristSizeA,
    wristSizeB,
    placedA,
    placedB,
    beadSizeMm,
    mirrorMode = "sequential",
    preferredStrand,
  } = input;

  if (preferredStrand === "B" && twinning) {
    if (canPlaceBeadSize(wristSizeB, placedB, beadSizeMm)) return "B";
    if (canPlaceBeadSize(wristSizeA, placedA, beadSizeMm)) return "A";
    return null;
  }

  if (preferredStrand === "A") {
    if (canPlaceBeadSize(wristSizeA, placedA, beadSizeMm)) return "A";
    if (twinning && canPlaceBeadSize(wristSizeB, placedB, beadSizeMm)) return "B";
    return null;
  }

  if (mirrorMode === "mirror" && twinning) {
    const fitsA = canPlaceBeadSize(wristSizeA, placedA, beadSizeMm);
    const fitsB = canPlaceBeadSize(wristSizeB, placedB, beadSizeMm);
    if (fitsA && fitsB) return "A";
    if (fitsA) return "A";
    if (fitsB) return "B";
    return null;
  }

  if (canPlaceBeadSize(wristSizeA, placedA, beadSizeMm)) return "A";

  if (twinning && canPlaceBeadSize(wristSizeB, placedB, beadSizeMm)) return "B";

  return null;
}

/** Whether automatic insertion should also mirror to strand B (future Auto Mirror). */
export function shouldMirrorPlacementToB(mirrorMode: MatchingPairMirrorMode): boolean {
  return mirrorMode === "mirror";
}

/** Derived from bracelet B contents — no persisted match flag. */
export function isMatchingPairMatched(placedB: PlacedBead[]): boolean {
  return placedB.length > 0;
}
