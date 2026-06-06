import { calculateBeadCount, placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";

import { normalizeFromSlots } from "./composition";

export const MIN_BEAD_SIZE_MM = 4;

export function wristCircumferenceMm(wristSizeCm: number): number {
  return wristSizeCm * 10;
}

export function maxStrandSlots(wristSizeCm: number, minBeadMm = MIN_BEAD_SIZE_MM): number {
  return calculateBeadCount(wristSizeCm, minBeadMm);
}

export function strandUsedMm(placed: PlacedBead[]): number {
  return normalizeFromSlots(placed).reduce((sum, b) => sum + placedBeadSizeMm(b), 0);
}

/** Remaining mm on target wrist; negative when over capacity. */
export function strandRemainingMm(wristSizeCm: number, placed: PlacedBead[]): number {
  return wristCircumferenceMm(wristSizeCm) - strandUsedMm(placed);
}

export function canPlaceBeadSize(
  wristSizeCm: number,
  placed: PlacedBead[],
  beadSizeMm: number,
): boolean {
  return strandRemainingMm(wristSizeCm, placed) >= beadSizeMm;
}

export function isStrandFull(
  wristSizeCm: number,
  placed: PlacedBead[],
  nextBeadMm?: number,
): boolean {
  const remaining = strandRemainingMm(wristSizeCm, placed);
  if (nextBeadMm !== undefined) return remaining < nextBeadMm;
  return remaining <= 0;
}

export function strandCapacity(wristSizeCm: number, beadSizeMm: number): number {
  return calculateBeadCount(wristSizeCm, beadSizeMm);
}

export function prunePlacedBeads(placed: PlacedBead[]): PlacedBead[] {
  return normalizeFromSlots(placed);
}

export function countPrunedBeads(before: PlacedBead[], after: PlacedBead[]): number {
  return Math.max(0, before.length - after.length);
}

export function strandFitsOnWrist(wristSizeCm: number, placed: PlacedBead[]): boolean {
  return strandUsedMm(placed) <= wristCircumferenceMm(wristSizeCm);
}

export function buildStrandFitMetrics(
  wristSizeCm: number,
  placed: PlacedBead[],
  minBeadMm = MIN_BEAD_SIZE_MM,
) {
  const wristMm = wristCircumferenceMm(wristSizeCm);
  const sorted = normalizeFromSlots(placed);
  const used = strandUsedMm(sorted);
  const remainingMm = wristMm - used;
  const capacityPercent = wristMm > 0 ? Math.round((used / wristMm) * 100) : 0;
  const isOverCapacity = used > wristMm;
  const overCapacityMm = Math.max(0, used - wristMm);

  return {
    wristCircumferenceMm: wristMm,
    usedMm: used,
    remainingMm,
    capacityPercent,
    isOverCapacity,
    overCapacityMm,
    maxSlots: maxStrandSlots(wristSizeCm, minBeadMm),
    placedCount: sorted.length,
  };
}
