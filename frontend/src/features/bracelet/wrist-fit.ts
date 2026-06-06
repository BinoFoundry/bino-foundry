import type { BraceletStrandFitMetrics, BraceletWristFitEstimate } from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";

import { strandUsedMm } from "./capacity";

/** @deprecated Composition-derived estimate — prefer wrist-target capacity metrics in UI. */
export function estimateWristFit(placed: PlacedBead[]): BraceletWristFitEstimate {
  const lengthMm = strandUsedMm(placed);
  if (lengthMm <= 0) {
    return { minCm: 0, maxCm: 0, lengthMm: 0, beadCount: 0 };
  }
  const centerCm = lengthMm / 10;
  return {
    lengthMm,
    beadCount: placed.length,
    minCm: Math.round(centerCm * 10) / 10,
    maxCm: Math.round(centerCm * 10) / 10,
  };
}

export function formatCapacityCm(mm: number): string {
  return `${(mm / 10).toFixed(1)} cm`;
}

export function formatTargetWristLabel(targetCm: number): string {
  return `${targetCm} cm bracelet`;
}

export function formatCapacitySummary(
  metrics: Pick<
    BraceletStrandFitMetrics,
    "wristCircumferenceMm" | "usedMm" | "remainingMm" | "capacityPercent" | "isOverCapacity"
  >,
  targetCm: number,
): string {
  if (metrics.usedMm <= 0) {
    return `${targetCm} cm target · ${formatCapacityCm(metrics.wristCircumferenceMm)} available`;
  }
  if (metrics.isOverCapacity) {
    return `Over capacity by ${formatCapacityCm(Math.abs(metrics.remainingMm))}`;
  }
  return `${formatCapacityCm(metrics.usedMm)} used · ${formatCapacityCm(Math.max(0, metrics.remainingMm))} remaining · ${metrics.capacityPercent}%`;
}

/** Footer / legacy helper — wrist-target first wording. */
export function formatWristFitRange(
  fit: BraceletWristFitEstimate,
  targetCm?: number,
): string {
  if (targetCm) return formatTargetWristLabel(targetCm);
  if (fit.beadCount === 0) return "Select your wrist size to begin";
  return `${(fit.lengthMm / 10).toFixed(1)} cm on strand`;
}

export function wristTargetStatus(
  _targetWristCm: number,
  usedMm: number,
  wristCircumferenceMm: number,
): "empty" | "under" | "ideal" | "over" {
  if (usedMm <= 0) return "empty";
  const ratio = usedMm / wristCircumferenceMm;
  if (ratio > 1) return "over";
  if (ratio >= 0.92) return "ideal";
  return "under";
}
