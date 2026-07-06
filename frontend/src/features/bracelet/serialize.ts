import {
  BRACELET_CONFIG_VERSION,
  type BraceletConfigurationItemRef,
  type BraceletConfigurationPayload,
  type BraceletConfigStatus,
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
    pricing,
    updatedAt: new Date().toISOString(),
  };
}
