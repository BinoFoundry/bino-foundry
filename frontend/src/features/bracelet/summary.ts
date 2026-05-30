import type { BraceletBuilderSummary, BraceletPricingBreakdown } from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";
import type { BeadSizeEntry } from "@/types/bead-sizes";

import { BRACELET_COPY } from "./copy";
import { strandCapacity } from "./capacity";

const CRYSTAL_SLUGS = new Set(["crystal", "accent"]);
const CHARM_SLUGS = new Set(["charm"]);
const SPACER_SLUGS = new Set(["spacer", "separator"]);

function groupByProductKind(pricing: BraceletPricingBreakdown) {
  const crystals: { name: string; quantity: number; subtotal: number }[] = [];
  const charms: { name: string; quantity: number; subtotal: number }[] = [];
  const spacers: { name: string; quantity: number; subtotal: number }[] = [];
  const other: { name: string; quantity: number; subtotal: number }[] = [];

  for (const item of pricing.lineItems) {
    const row = { name: item.beadName, quantity: item.quantity, subtotal: item.lineTotal };
    if (CRYSTAL_SLUGS.has(item.beadTypeSlug)) crystals.push(row);
    else if (CHARM_SLUGS.has(item.beadTypeSlug)) charms.push(row);
    else if (SPACER_SLUGS.has(item.beadTypeSlug)) spacers.push(row);
    else other.push(row);
  }

  return { crystals, charms, spacers, other };
}

export function formatBraceletConfigSummary(
  twinning: boolean,
  wristA: number,
  wristB: number,
  defaultSizeMm: number,
  placedCount: number,
  capacity: number,
): string {
  const wrist = twinning
    ? `${wristA} cm & ${wristB} cm wrists`
    : `${wristA} cm wrist`;
  const sizeLabel =
    `${defaultSizeMm} mm beads · ${placedCount} of ${capacity} placed`;
  return `${wrist} · ${sizeLabel}`;
}

export function buildBraceletBuilderSummary(
  placedA: PlacedBead[],
  placedB: PlacedBead[],
  twinning: boolean,
  wristA: number,
  wristB: number,
  defaultSizeMm: number,
  pricing: BraceletPricingBreakdown,
  beadSizes?: BeadSizeEntry[],
): BraceletBuilderSummary {
  const capacityA = strandCapacity(wristA, defaultSizeMm);
  const capacityB = twinning ? strandCapacity(wristB, defaultSizeMm) : 0;
  const sizeLabel = beadSizes?.find((s) => s.sizeMm === defaultSizeMm)?.label ?? `${defaultSizeMm} mm`;
  const { crystals, charms, spacers, other } = groupByProductKind(pricing);

  const strands = [
    {
      index: 0 as const,
      label: twinning ? BRACELET_COPY.wristTwinA : "Your bracelet",
      wristSizeCm: wristA,
      capacity: capacityA,
      placedCount: placedA.length,
    },
  ];
  if (twinning) {
    strands.push({
      index: 1 as const,
      label: BRACELET_COPY.wristTwinB,
      wristSizeCm: wristB,
      capacity: capacityB,
      placedCount: placedB.length,
    });
  }

  return {
    strands,
    twinning,
    defaultBeadSizeMm: defaultSizeMm,
    beadSizeLabel: sizeLabel,
    crystals,
    charms,
    spacers,
    other,
    pricing,
    configSummary: formatBraceletConfigSummary(
      twinning,
      wristA,
      wristB,
      defaultSizeMm,
      pricing.placedCount,
      pricing.capacityCount,
    ),
  };
}
