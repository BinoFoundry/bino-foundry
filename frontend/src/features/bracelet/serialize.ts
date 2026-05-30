import {
  BRACELET_CONFIG_VERSION,
  type BraceletConfigurationItemRef,
  type BraceletConfigurationPayload,
  type BraceletConfigStatus,
  type BraceletPricingBreakdown,
} from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";

function strandItems(placed: PlacedBead[], strandIndex: 0 | 1): BraceletConfigurationItemRef[] {
  return placed.map((b) => ({
    strandIndex,
    slotPosition: b.position,
    beadLibraryId: b.bead.id,
    beadSizeMm: b.beadSize,
  }));
}

/** Checkout-ready payload (IDs + pricing only — no images or crop paths). */
export function serializeBraceletConfiguration(
  placedA: PlacedBead[],
  placedB: PlacedBead[],
  twinning: boolean,
  wristA: number,
  wristB: number,
  defaultBeadSizeMm: PlacedBead["beadSize"],
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
    defaultBeadSizeMm: defaultBeadSizeMm,
    items,
    pricing,
    updatedAt: new Date().toISOString(),
  };
}
