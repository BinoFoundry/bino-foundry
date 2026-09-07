import type {
  OrderSnapshotBeadItem,
  OrderSnapshotBeadRender,
  OrderSnapshotBracelet,
} from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadAvailabilityStatus } from "@/types/bead-availability";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import {
  buildPlacedFromSavedBracelet,
  type SavedBraceletLoadInput,
} from "./load-saved-bracelet";
import { createUnavailablePlacedBead } from "./unavailable-bead";

/** Identity fields shared by a placed bead and by a frame attached to one. */
interface FrozenIdentity {
  beadLibraryId: string;
  beadName: string;
  beadTypeSlug?: string;
  beadSizeMm: number;
  sizeLabel: string;
  unitPrice: number;
  offerKey?: string;
}

/** Rebuild a catalogue entry + size offer purely from the frozen order payload. */
function frozenBeadAndSize(
  item: FrozenIdentity,
  render: OrderSnapshotBeadRender,
): { bead: BeadLibraryEntry; size: BeadLibrarySizeOffer } {
  const metadata: Record<string, unknown> = {
    ...(render.metadata ?? {}),
  };
  if (render.strandRenderProfile) {
    metadata.frozenStrandRenderProfile = render.strandRenderProfile;
  }

  const bead: BeadLibraryEntry = {
    id: item.beadLibraryId,
    name: item.beadName,
    image: render.image || render.processedImage || render.originalImage || "",
    originalImage: render.originalImage,
    processedImage: render.processedImage,
    beadTypeId: render.beadTypeId ?? "",
    beadTypeSlug: render.beadTypeSlug ?? item.beadTypeSlug,
    subBeadTypeId: render.subBeadTypeId,
    subBeadTypeSlug: render.subBeadTypeSlug,
    description: "",
    cropConfig: render.cropConfig ?? null,
    metadata,
  };

  const offerKey = render.offerKey || item.offerKey || `${item.beadLibraryId}-${item.beadSizeMm}`;
  const size: BeadLibrarySizeOffer = {
    id: `order-snap-${offerKey}`,
    offerKey,
    beadLibraryId: item.beadLibraryId,
    beadSizeId: "",
    sizeMm: item.beadSizeMm,
    label: item.sizeLabel || `${item.beadSizeMm} mm`,
    unitPrice: item.unitPrice,
    normalizationFactor: render.normalizationFactor,
    assetVisibleDiameterPx: render.assetVisibleDiameterPx,
    groupReferenceDiameterPx: render.groupReferenceDiameterPx,
    normalizedProcessedImageUrl: render.normalizedProcessedImageUrl,
    normalizedDeliveryUrls: render.normalizedDeliveryUrls,
    normalizedVisibleDiameterPx: render.normalizedVisibleDiameterPx,
  };

  return { bead, size };
}

function placedFromFrozenItem(item: OrderSnapshotBeadItem): PlacedBead {
  const { bead, size } = frozenBeadAndSize(item, item.render!);
  // The halo is frozen alongside its bead, so it replays without the catalogue.
  const frame = item.frame?.render
    ? frozenBeadAndSize(item.frame, item.frame.render)
    : undefined;
  return {
    position: item.slotPosition,
    bead,
    size,
    ...(frame ? { frame } : {}),
    ...(item.flipped ? { flipped: true } : {}),
  };
}

function buildStrandFromFrozen(items: OrderSnapshotBeadItem[], strandIndex: 0 | 1): PlacedBead[] {
  return items
    .filter((item) => item.strandIndex === strandIndex)
    .sort((a, b) => a.slotPosition - b.slotPosition)
    .map((item) => {
      if (item.render?.image || item.render?.processedImage || item.render?.originalImage) {
        return placedFromFrozenItem(item);
      }
      if (item.render?.strandRenderProfile) {
        return placedFromFrozenItem(item);
      }
      return createUnavailablePlacedBead({
        position: item.slotPosition,
        sizeMm: item.beadSizeMm,
        issue: "deleted",
        savedPublicId: item.beadLibraryId,
        unitPrice: item.unitPrice,
      });
    });
}

export function orderBraceletHasFrozenRender(bracelet: OrderSnapshotBracelet): boolean {
  return bracelet.items.some(
    (item) =>
      Boolean(item.render?.strandRenderProfile) ||
      Boolean(item.render?.image || item.render?.processedImage || item.render?.originalImage),
  );
}

export interface OrderBraceletPlacedResult {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  placedBeadsA: PlacedBead[];
  placedBeadsB: PlacedBead[];
  usedFrozenRender: boolean;
  unavailableCount: number;
}

/**
 * Hydrate strand beads for admin order replay.
 * Prefers frozen checkout render payloads; falls back to live catalogue for legacy orders.
 */
export function buildPlacedFromOrderBracelet(
  bracelet: OrderSnapshotBracelet,
  catalogue?: {
    beadLibraries: BeadLibraryEntry[];
    beadLibrarySizes: BeadLibrarySizeOffer[];
    wristSizes: WristSizeEntry[];
    beadAvailabilityStatuses?: BeadAvailabilityStatus[];
  },
): OrderBraceletPlacedResult {
  if (orderBraceletHasFrozenRender(bracelet)) {
    const placedBeadsA = buildStrandFromFrozen(bracelet.items, 0);
    const placedBeadsB = bracelet.twinning ? buildStrandFromFrozen(bracelet.items, 1) : [];
    return {
      twinning: bracelet.twinning,
      wristSizeCmA: bracelet.wristSizeCmA,
      wristSizeCmB: bracelet.wristSizeCmB,
      placedBeadsA,
      placedBeadsB,
      usedFrozenRender: true,
      unavailableCount:
        placedBeadsA.filter((b) => b.bead.metadata?.isPlaceholder).length +
        placedBeadsB.filter((b) => b.bead.metadata?.isPlaceholder).length,
    };
  }

  const input: SavedBraceletLoadInput = {
    twinning: bracelet.twinning,
    wristSizeCmA: bracelet.wristSizeCmA,
    wristSizeCmB: bracelet.wristSizeCmB,
    items: bracelet.items.map((item) => ({
      strandIndex: item.strandIndex,
      slotPosition: item.slotPosition,
      beadLibraryId: item.beadLibraryId,
      beadSizeMm: item.beadSizeMm,
      offerKey: item.offerKey,
      unitPrice: item.unitPrice,
      ...(item.flipped ? { flipped: true } : {}),
      ...(item.frame
        ? {
            frame: {
              beadLibraryId: item.frame.beadLibraryId,
              beadSizeMm: item.frame.beadSizeMm,
              offerKey: item.frame.offerKey,
            },
          }
        : {}),
    })),
  };

  if (!catalogue) {
    return {
      twinning: bracelet.twinning,
      wristSizeCmA: bracelet.wristSizeCmA,
      wristSizeCmB: bracelet.wristSizeCmB,
      placedBeadsA: [],
      placedBeadsB: [],
      usedFrozenRender: false,
      unavailableCount: bracelet.items.length,
    };
  }

  const loaded = buildPlacedFromSavedBracelet(
    input,
    catalogue.beadLibraries,
    catalogue.beadLibrarySizes,
    catalogue.wristSizes,
    catalogue.beadAvailabilityStatuses ?? [],
  );

  return {
    twinning: bracelet.twinning,
    wristSizeCmA: bracelet.wristSizeCmA,
    wristSizeCmB: bracelet.wristSizeCmB,
    placedBeadsA: loaded.placedBeadsA,
    placedBeadsB: loaded.placedBeadsB,
    usedFrozenRender: false,
    unavailableCount: loaded.unavailableCount,
  };
}
