import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import { findSizeOfferByKey } from "./library-sizes";
import {
  createUnavailablePlacedBead,
  isBeadVisibleInBuilder,
  type UnavailableBeadIssue,
} from "./unavailable-bead";
import type { BeadAvailabilityStatus } from "@/types/bead-availability";

export interface SavedBraceletItem {
  strandIndex: 0 | 1;
  slotPosition: number;
  beadLibraryId: string;
  beadSizeMm: number;
  offerKey?: string;
  catalogIssue?: UnavailableBeadIssue | null;
  unitPrice?: number;
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

function statusMap(statuses: BeadAvailabilityStatus[]): Map<string, { showInBuilder: boolean }> {
  return new Map(statuses.map((s) => [s.code, { showInBuilder: s.showInBuilder }]));
}

function buildPlaced(
  items: SavedBraceletItem[],
  strandIndex: 0 | 1,
  beadLibraries: BeadLibraryEntry[],
  beadLibrarySizes: BeadLibrarySizeOffer[],
  availabilityStatuses: BeadAvailabilityStatus[],
): PlacedBead[] {
  const builderVisibility = statusMap(availabilityStatuses);

  return items
    .filter((item) => item.strandIndex === strandIndex)
    .sort((a, b) => a.slotPosition - b.slotPosition)
    .map((item) => {
      const bead = findBead(beadLibraries, item.beadLibraryId);
      if (!bead) {
        return createUnavailablePlacedBead({
          position: item.slotPosition,
          sizeMm: item.beadSizeMm,
          issue: item.catalogIssue === "unavailable" ? "unavailable" : "deleted",
          savedPublicId: item.beadLibraryId,
          unitPrice: item.unitPrice,
        });
      }

      if (
        item.catalogIssue === "deleted" ||
        item.catalogIssue === "unavailable" ||
        !isBeadVisibleInBuilder(bead, builderVisibility)
      ) {
        return createUnavailablePlacedBead({
          position: item.slotPosition,
          sizeMm: item.beadSizeMm,
          issue: item.catalogIssue === "unavailable" ? "unavailable" : "deleted",
          savedPublicId: item.beadLibraryId,
          unitPrice: item.unitPrice,
        });
      }

      const size = resolveSizeOffer(bead, item, beadLibrarySizes);
      if (!size) {
        return createUnavailablePlacedBead({
          position: item.slotPosition,
          sizeMm: item.beadSizeMm,
          issue: "deleted",
          savedPublicId: item.beadLibraryId,
          unitPrice: item.unitPrice,
        });
      }

      return {
        position: item.slotPosition,
        bead,
        size,
      } satisfies PlacedBead;
    });
}

export function buildPlacedFromSavedBracelet(
  input: SavedBraceletLoadInput,
  beadLibraries: BeadLibraryEntry[],
  beadLibrarySizes: BeadLibrarySizeOffer[],
  wristSizes: import("@/types/wrist-sizes").WristSizeEntry[],
  availabilityStatuses: BeadAvailabilityStatus[] = [],
) {
  const wristA = wristSizes.find((s) => s.sizeCm === input.wristSizeCmA) ?? wristSizes[0];
  const wristB = wristSizes.find((s) => s.sizeCm === input.wristSizeCmB) ?? wristA;

  const placedBeadsA = buildPlaced(input.items, 0, beadLibraries, beadLibrarySizes, availabilityStatuses);
  const placedBeadsB = input.twinning
    ? buildPlaced(input.items, 1, beadLibraries, beadLibrarySizes, availabilityStatuses)
    : [];

  return {
    twinning: input.twinning,
    wristSizeIdA: wristA?.id ?? null,
    wristSizeIdB: wristB?.id ?? null,
    placedBeadsA,
    placedBeadsB,
    unavailableCount:
      placedBeadsA.filter((b) => b.bead.metadata?.isPlaceholder).length +
      placedBeadsB.filter((b) => b.bead.metadata?.isPlaceholder).length,
  };
}
