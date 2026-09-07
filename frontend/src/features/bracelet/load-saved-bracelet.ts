import type { PlacedBead, PlacedBeadFrame } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import { findSizeOfferByKey } from "./library-sizes";
import {
  createUnavailablePlacedBead,
  isBeadVisibleInBuilder,
  type UnavailableBeadIssue,
} from "./unavailable-bead";
import type { BeadAvailabilityStatus } from "@/types/bead-availability";

export interface SavedBraceletFrame {
  beadLibraryId: string;
  beadSizeMm: number;
  offerKey?: string;
}

export interface SavedBraceletItem {
  strandIndex: 0 | 1;
  slotPosition: number;
  beadLibraryId: string;
  beadSizeMm: number;
  offerKey?: string;
  catalogIssue?: UnavailableBeadIssue | null;
  unitPrice?: number;
  /** Halo attached to this bead — no slot of its own. */
  frame?: SavedBraceletFrame;
  /** Turned around by hand when the design was saved. */
  flipped?: boolean;
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
    return findSizeOfferByKey(beadLibrarySizes, item.offerKey, { includeUnavailable: true });
  }
  return beadLibrarySizes.find(
    (s) => s.beadLibraryId === bead.id && s.sizeMm === item.beadSizeMm,
  );
}

/**
 * Rehydrate a halo from the live catalogue.
 *
 * Returns undefined when the frame bead or its size has gone: the bead it wraps
 * is still perfectly valid, so the design opens with the bead intact and the
 * halo quietly dropped rather than the whole slot flagged unavailable.
 */
function resolveFrame(
  frame: SavedBraceletFrame | undefined,
  beadLibraries: BeadLibraryEntry[],
  beadLibrarySizes: BeadLibrarySizeOffer[],
): PlacedBeadFrame | undefined {
  if (!frame) return undefined;
  const bead = findBead(beadLibraries, frame.beadLibraryId);
  if (!bead) return undefined;
  const size = frame.offerKey
    ? findSizeOfferByKey(beadLibrarySizes, frame.offerKey, { includeUnavailable: true })
    : beadLibrarySizes.find(
        (s) => s.beadLibraryId === bead.id && s.sizeMm === frame.beadSizeMm,
      );
  if (!size) return undefined;
  return { bead, size };
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

      const frame = resolveFrame(item.frame, beadLibraries, beadLibrarySizes);

      // Soft-disabled / sold-out size: keep the bead visible but mark it for replacement.
      if (size.availableForNew === false) {
        return {
          position: item.slotPosition,
          bead: {
            ...bead,
            metadata: {
              ...(bead.metadata ?? {}),
              catalogIssue: "unavailable",
            },
          },
          size,
          ...(frame ? { frame } : {}),
          ...(item.flipped ? { flipped: true } : {}),
        } satisfies PlacedBead;
      }

      return {
        position: item.slotPosition,
        bead,
        size,
        ...(frame ? { frame } : {}),
        ...(item.flipped ? { flipped: true } : {}),
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
