import {
  BRACELET_CONFIG_VERSION,
  type BraceletConfigurationItemRef,
  type BraceletConfigurationPayload,
  type BraceletConfigStatus,
  type BraceletPreparationSelection,
  type BraceletPricingBreakdown,
} from "@bino-foundry/shared/types";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";

import { isUnavailablePlacedBead } from "./unavailable-bead";

function strandItems(placed: PlacedBead[], strandIndex: 0 | 1): BraceletConfigurationItemRef[] {
  return placed
    .filter((b) => !isUnavailablePlacedBead(b))
    .map((b) => ({
      strandIndex,
      slotPosition: b.position,
      beadLibraryId: b.bead.id,
      beadSizeMm: placedBeadSizeMm(b),
      // A halo rides along with the bead it wraps rather than taking a slot.
      // Omitted entirely when absent, so a design without frames serialises
      // byte-identically to before.
      ...(b.frame
        ? { frame: { beadLibraryId: b.frame.bead.id, beadSizeMm: b.frame.size.sizeMm } }
        : {}),
      // Only recorded when turned, so an untouched design serialises as before.
      ...(b.flipped ? { flipped: true } : {}),
    }));
}

export function serializeBraceletConfiguration(
  placedA: PlacedBead[],
  placedB: PlacedBead[],
  twinning: boolean,
  wristA: number,
  wristB: number,
  pricing: BraceletPricingBreakdown,
  status: BraceletConfigStatus = "draft",
  preparation: BraceletPreparationSelection | null = null,
): BraceletConfigurationPayload {
  const items: BraceletConfigurationItemRef[] = [
    ...strandItems(placedA, 0),
    ...(twinning ? strandItems(placedB, 1) : []),
  ];

  return {
    version: BRACELET_CONFIG_VERSION,
    status,
    twinning,
    wristSizeCmA: wristA,
    wristSizeCmB: wristB,
    items,
    preparation: preparation ?? undefined,
    pricing,
    updatedAt: new Date().toISOString(),
  };
}
