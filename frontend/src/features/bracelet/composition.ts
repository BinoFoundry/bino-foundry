import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";

/** Guide ring slot count when the strand is empty (display only). */
export const EMPTY_GUIDE_SLOT_COUNT = 8;

/**
 * Dense sequence order — array order is the source of truth; `position` mirrors index.
 * When loading sparse slot data, call `normalizeFromSlots` once first.
 */
export function normalizeSequence(placed: PlacedBead[]): PlacedBead[] {
  return placed.map((b, i) => (b.position === i ? b : { ...b, position: i }));
}

/** One-time migration from sparse slot indices to dense sequence order. */
export function normalizeFromSlots(placed: PlacedBead[]): PlacedBead[] {
  return [...placed]
    .sort((a, b) => a.position - b.position)
    .map((b, i) => ({ ...b, position: i }));
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
  const composition = strandCircumferenceMm(placed, guideMm);
  if (normalizeFromSlots(placed).length === 0) {
    return EMPTY_GUIDE_SLOT_COUNT * guideMm;
  }
  return Math.max(composition, wristSizeCm * 10, EMPTY_GUIDE_SLOT_COUNT * guideMm);
}

/** Composition length (mm) — drives pricing/fit, independent of wrist target. */
export function strandCircumferenceMm(placed: PlacedBead[], guideMm: number): number {
  const sorted = normalizeFromSlots(placed);
  if (sorted.length === 0) return EMPTY_GUIDE_SLOT_COUNT * guideMm;
  return sorted.reduce((sum, b) => sum + placedBeadSizeMm(b), 0);
}

/** Largest arc gap on the ring — best place to auto-insert the next bead. */
export function findBestInsertIndex(placed: PlacedBead[], newMm: number): number {
  const sorted = normalizeFromSlots(placed);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return 1;

  let bestIdx = 1;
  let bestGap = -1;
  for (let i = 0; i < n; i++) {
    const curr = sorted[i]!;
    const next = sorted[(i + 1) % n]!;
    const gap = placedBeadSizeMm(curr) + placedBeadSizeMm(next) + newMm * 0.01;
    const insertIdx = i + 1;
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = insertIdx;
    }
  }
  return Math.min(bestIdx, n);
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

export function insertBeadWithAutoLayout(placed: PlacedBead[], bead: PlacedBead): PlacedBead[] {
  const idx = findBestInsertIndex(placed, placedBeadSizeMm(bead));
  return insertBeadAt(placed, idx, bead);
}

export function removeBeadAt(placed: PlacedBead[], index: number): PlacedBead[] {
  const sorted = normalizeFromSlots(placed);
  if (index < 0 || index >= sorted.length) return sorted;
  return normalizeSequence(sorted.filter((_, i) => i !== index));
}
