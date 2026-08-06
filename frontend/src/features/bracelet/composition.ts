import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";

import { ensurePlacementInstanceIds } from "./placement-instance";

/** Guide ring slot count when the strand is empty (display only). */
export const EMPTY_GUIDE_SLOT_COUNT = 8;

/**
 * Dense sequence order — array order is the source of truth; `position` mirrors index.
 */
export function normalizeSequence(placed: PlacedBead[]): PlacedBead[] {
  return placed.map((b, i) => (b.position === i ? b : { ...b, position: i }));
}

/** True when `position` values are legacy sparse slots (gaps or duplicates). */
export function needsSparseSlotMigration(placed: PlacedBead[]): boolean {
  if (placed.length === 0) return false;
  const maxPos = Math.max(...placed.map((b) => b.position));
  if (maxPos >= placed.length) return true;
  const seen = new Set<number>();
  for (const b of placed) {
    if (seen.has(b.position)) return true;
    seen.add(b.position);
  }
  return false;
}

/**
 * Dense strand sequence for rendering and mutations.
 * Array order is authoritative; only legacy sparse data is sorted by `position` once.
 */
export function normalizeFromSlots(placed: PlacedBead[]): PlacedBead[] {
  const ordered = needsSparseSlotMigration(placed)
    ? [...placed].sort((a, b) => a.position - b.position)
    : [...placed];
  return ensurePlacementInstanceIds(normalizeSequence(ordered));
}

export function getBeadAtIndex(placed: PlacedBead[], index: number): PlacedBead | undefined {
  return normalizeFromSlots(placed)[index];
}

/** Visual slot count: one add affordance when empty, otherwise beads + one insertion slot. */
export function strandDisplaySlotCount(placed: PlacedBead[]): number {
  const n = normalizeFromSlots(placed).length;
  return n === 0 ? 1 : n + 1;
}

/**
 * Visual ring circumference (mm) — keeps a full bracelet circle even with few beads.
 * Calculation/pricing still uses `strandCircumferenceMm` (actual composition only).
 */
export function computeVisualLayoutCircumferenceMm(
  placed: PlacedBead[],
  guideMm: number,
  wristSizeCm: number,
): number {
  const wristMm = wristSizeCm * 10;
  if (normalizeFromSlots(placed).length === 0) {
    return Math.max(wristMm, EMPTY_GUIDE_SLOT_COUNT * guideMm);
  }
  return Math.max(wristMm, EMPTY_GUIDE_SLOT_COUNT * guideMm);
}

/** Composition length (mm) — drives pricing/fit, independent of wrist target. */
export function strandCircumferenceMm(placed: PlacedBead[], guideMm: number): number {
  const sorted = normalizeFromSlots(placed);
  if (sorted.length === 0) return EMPTY_GUIDE_SLOT_COUNT * guideMm;
  return sorted.reduce((sum, b) => sum + placedBeadSizeMm(b), 0);
}

/**
 * Auto-place index for contiguous sequential packing.
 * Always append so chronological insertion order is preserved (A → B → C → D).
 * Do not redistribute into balanced angular gaps — that reshuffles neighbors and
 * fights the linked-chain renderer.
 */
export function findBestInsertIndex(placed: PlacedBead[], _newMm?: number): number {
  return normalizeFromSlots(placed).length;
}

export function insertBeadAt(
  placed: PlacedBead[],
  index: number,
  bead: PlacedBead,
): PlacedBead[] {
  const sorted = normalizeFromSlots(placed);
  const at = Math.max(0, Math.min(index, sorted.length));
  const next = [...sorted.slice(0, at), bead, ...sorted.slice(at)];
  return normalizeSequence(next);
}

/** Append the bead after the current sequence (preserves insertion order). */
export function insertBeadWithAutoLayout(placed: PlacedBead[], bead: PlacedBead): PlacedBead[] {
  return insertBeadAt(placed, findBestInsertIndex(placed), bead);
}

export function removeBeadAt(placed: PlacedBead[], index: number): PlacedBead[] {
  const sorted = normalizeFromSlots(placed);
  if (index < 0 || index >= sorted.length) return sorted;
  return normalizeSequence(sorted.filter((_, i) => i !== index));
}

/** Swap bead at index — preserves position and sequence order. */
export function replaceBeadAt(placed: PlacedBead[], index: number, bead: PlacedBead): PlacedBead[] {
  const sorted = normalizeFromSlots(placed);
  if (index < 0 || index >= sorted.length) return sorted;
  return normalizeSequence(sorted.map((b, i) => (i === index ? { ...bead, position: i } : b)));
}
