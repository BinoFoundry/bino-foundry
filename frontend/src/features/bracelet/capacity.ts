import { calculateBeadCount, placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";

import { normalizeFromSlots } from "./composition";

/** Smallest catalog mm — used for advisory wrist-fit estimates only. */
export const MIN_BEAD_SIZE_MM = 4;

export function wristCircumferenceMm(wristSizeCm: number): number {
  return wristSizeCm * 10;
}

/** Advisory estimate: how many smallest-mm beads fit a target wrist (not a placement cap). */
export function maxStrandSlots(wristSizeCm: number, minBeadMm = MIN_BEAD_SIZE_MM): number {
  return calculateBeadCount(wristSizeCm, minBeadMm);
}

export function strandUsedMm(placed: PlacedBead[]): number {
  return normalizeFromSlots(placed).reduce((sum, b) => sum + placedBeadSizeMm(b), 0);
}

export function strandRemainingMm(wristSizeCm: number, placed: PlacedBead[]): number {
  return Math.max(0, wristCircumferenceMm(wristSizeCm) - strandUsedMm(placed));
}

/** Placement is never blocked — bracelet length grows with composition. */
export function canPlaceBeadSize(
  _wristSizeCm: number,
  _placed: PlacedBead[],
  _beadSizeMm: number,
): boolean {
  return true;
}

/** Strand is never "full" — users can always add another bead. */
export function isStrandFull(
  _wristSizeCm: number,
  _placed: PlacedBead[],
): boolean {
  return false;
}

export function strandCapacity(wristSizeCm: number, beadSizeMm: number): number {
  return calculateBeadCount(wristSizeCm, beadSizeMm);
}

/** Keeps dense sequence indices; no wrist/slot pruning. */
export function prunePlacedBeads(placed: PlacedBead[]): PlacedBead[] {
  return normalizeFromSlots(placed);
}

export function countPrunedBeads(before: PlacedBead[], after: PlacedBead[]): number {
  return Math.max(0, before.length - after.length);
}

export function buildStrandFitMetrics(
  wristSizeCm: number,
  placed: PlacedBead[],
  minBeadMm = MIN_BEAD_SIZE_MM,
) {
  const wristMm = wristCircumferenceMm(wristSizeCm);
  const sorted = normalizeFromSlots(placed);
  const used = strandUsedMm(sorted);
  return {
    wristCircumferenceMm: wristMm,
    usedMm: used,
    remainingMm: Math.max(0, wristMm - used),
    /** Advisory reference — smallest-mm capacity at target wrist. */
    maxSlots: maxStrandSlots(wristSizeCm, minBeadMm),
    placedCount: sorted.length,
  };
}
