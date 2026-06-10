import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { findSizeOfferByKey } from "./library-sizes";

export interface SavedBraceletItem {
  strandIndex: 0 | 1;
  slotPosition: number;
  beadLibraryId: string;
  beadSizeMm: number;
  offerKey?: string;
}

export interface SavedBraceletLoadInput {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  items: SavedBraceletItem[];
}

function findBead(beadLibraries: BeadLibraryEntry[], publicId: string): BeadLibraryEntry | undefined {
  return beadLibraries.find((b) => b.id === publicId);
}

function resolveSizeOffer(
  bead: BeadLibraryEntry,
  item: SavedBraceletItem,
  beadLibrarySizes: BeadLibrarySizeOffer[],
): BeadLibrarySizeOffer | undefined {
  if (item.offerKey) {
    return findSizeOfferByKey(beadLibrarySizes, item.offerKey);
  }
  return beadLibrarySizes.find(
    (s) => s.beadLibraryId === bead.id && s.sizeMm === item.beadSizeMm,
  );
}

function buildPlaced(
  items: SavedBraceletItem[],
  strandIndex: 0 | 1,
  beadLibraries: BeadLibraryEntry[],
  beadLibrarySizes: BeadLibrarySizeOffer[],
): PlacedBead[] {
  return items
    .filter((item) => item.strandIndex === strandIndex)
    .sort((a, b) => a.slotPosition - b.slotPosition)
    .map((item) => {
      const bead = findBead(beadLibraries, item.beadLibraryId);
      if (!bead) return null;
      const size = resolveSizeOffer(bead, item, beadLibrarySizes);
      if (!size) return null;
      return {
        position: item.slotPosition,
        bead,
        size,
      } satisfies PlacedBead;
    })
    .filter((p): p is PlacedBead => p !== null);
}

export function buildPlacedFromSavedBracelet(
  input: SavedBraceletLoadInput,
  beadLibraries: BeadLibraryEntry[],
  beadLibrarySizes: BeadLibrarySizeOffer[],
  wristSizes: WristSizeEntry[],
) {
  const wristA = wristSizes.find((s) => s.sizeCm === input.wristSizeCmA) ?? wristSizes[0];
  const wristB = wristSizes.find((s) => s.sizeCm === input.wristSizeCmB) ?? wristA;

  return {
    twinning: input.twinning,
    wristSizeIdA: wristA?.id ?? null,
    wristSizeIdB: wristB?.id ?? null,
    placedBeadsA: buildPlaced(input.items, 0, beadLibraries, beadLibrarySizes),
    placedBeadsB: input.twinning ? buildPlaced(input.items, 1, beadLibraries, beadLibrarySizes) : [],
  };
}
