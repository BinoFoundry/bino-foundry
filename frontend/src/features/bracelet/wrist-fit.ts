import type { BraceletWristFitEstimate } from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";
import { placedBeadSizeMm } from "@/lib/luxe-data";

import { strandUsedMm } from "./capacity";

/** Comfort band: strand length maps to wrist circumference ±5%. */
const FIT_TOLERANCE = 0.05;

export function estimateWristFit(placed: PlacedBead[]): BraceletWristFitEstimate {
  const lengthMm = strandUsedMm(placed);
  if (lengthMm <= 0) {
    return { minCm: 0, maxCm: 0, lengthMm: 0, beadCount: 0 };
  }
  const centerCm = lengthMm / 10;
  return {
    lengthMm,
    beadCount: placed.length,
    minCm: Math.round(centerCm * (1 - FIT_TOLERANCE) * 10) / 10,
    maxCm: Math.round(centerCm * (1 + FIT_TOLERANCE) * 10) / 10,
  };
}

export function formatWristFitRange(fit: BraceletWristFitEstimate): string {
  if (fit.beadCount === 0) return "Add beads to see wrist fit";
  if (fit.minCm === fit.maxCm) return `Fits ~${fit.minCm} cm wrist`;
  return `Fits ${fit.minCm} cm – ${fit.maxCm} cm wrists`;
}

export function wristTargetStatus(
  targetWristCm: number,
  usedMm: number,
  wristCircumferenceMm: number,
): "under" | "ideal" | "over" {
  if (usedMm <= 0) return "under";
  const ratio = usedMm / wristCircumferenceMm;
  if (ratio < 0.88) return "under";
  if (ratio > 1.02) return "over";
  return "ideal";
}

export function placedBeadSizeMmFromPlaced(placed: PlacedBead[]): number[] {
  return placed.map(placedBeadSizeMm);
}
