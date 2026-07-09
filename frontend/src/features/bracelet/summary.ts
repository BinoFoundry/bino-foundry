import type {
  BraceletBuilderSummary,
  BraceletMaterialSection,
  BraceletPricingBreakdown,
} from "@bino-foundry/shared/types";

import type { PlacedBead } from "@/lib/luxe-data";

import type { BeadTypeEntry } from "@/types/beads";

import { BRACELET_COPY } from "./copy";
import { formatPricingLineItemLabel } from "./pricing";
import { estimateWristFit, formatTargetWristLabel } from "./wrist-fit";

const CRYSTAL_SLUGS = new Set(["crystal", "accent"]);
const CHARM_SLUGS = new Set(["charm"]);
const SPACER_SLUGS = new Set(["spacer", "separator"]);

function groupByProductKind(pricing: BraceletPricingBreakdown) {
  const crystals: { name: string; quantity: number; subtotal: number }[] = [];
  const charms: { name: string; quantity: number; subtotal: number }[] = [];
  const spacers: { name: string; quantity: number; subtotal: number }[] = [];
  const other: { name: string; quantity: number; subtotal: number }[] = [];

  for (const item of pricing.lineItems) {
    const row = {
      name: formatPricingLineItemLabel({ ...item, quantity: 1 }),
      quantity: item.quantity,
      subtotal: item.lineTotal,
    };
    if (CRYSTAL_SLUGS.has(item.beadTypeSlug)) crystals.push(row);
    else if (CHARM_SLUGS.has(item.beadTypeSlug)) charms.push(row);
    else if (SPACER_SLUGS.has(item.beadTypeSlug)) spacers.push(row);
    else other.push(row);
  }

  return { crystals, charms, spacers, other };
}

function buildMaterialSections(
  pricing: BraceletPricingBreakdown,
  beadTypes: BeadTypeEntry[],
): BraceletMaterialSection[] {
  const activeTypes = [...beadTypes]
    .filter((t) => t.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const buckets = new Map<string, BraceletMaterialSection>();

  for (const item of pricing.lineItems) {
    const slug = item.beadTypeSlug || "other";
    const title = activeTypes.find((t) => t.slug === slug)?.name ?? slug.replace(/-/g, " ");
    if (!buckets.has(slug)) {
      buckets.set(slug, { slug, title, rows: [] });
    }
    buckets.get(slug)!.rows.push({
      name: formatPricingLineItemLabel({ ...item, quantity: 1 }),
      quantity: item.quantity,
      subtotal: item.lineTotal,
    });
  }

  const ordered: BraceletMaterialSection[] = [];
  for (const t of activeTypes) {
    const section = buckets.get(t.slug);
    if (section?.rows.length) ordered.push(section);
  }
  for (const [slug, section] of buckets) {
    if (!activeTypes.some((t) => t.slug === slug) && section.rows.length) {
      ordered.push(section);
    }
  }
  return ordered;
}

function joinedWristFitLabel(twinning: boolean, wristA: number, wristB: number): string {
  if (!twinning) return formatTargetWristLabel(wristA);
  return `${BRACELET_COPY.wristTwinA}: ${formatTargetWristLabel(wristA)} · ${BRACELET_COPY.wristTwinB}: ${formatTargetWristLabel(wristB)}`;
}

export function formatBraceletConfigSummary(
  twinning: boolean,
  wristA: number,
  wristB: number,
  pricing: BraceletPricingBreakdown,
  wristFitLabel: string,
): string {
  const wrist = twinning
    ? `${wristA} cm & ${wristB} cm wrists`
    : `${wristA} cm wrist`;
  const { strandA, strandB } = pricing.strandFit;
  const length = twinning && strandB
    ? `${strandA.usedMm + strandB.usedMm} mm total length`
    : `${strandA.usedMm} mm strand length`;
  return `${wrist} · ${length} · ${wristFitLabel} · ${pricing.placedCount} pieces`;
}

export function buildBraceletBuilderSummary(
  placedA: PlacedBead[],
  placedB: PlacedBead[],
  twinning: boolean,
  wristA: number,
  wristB: number,
  selectedSizeOfferKey: string | null,
  selectedSizeLabel: string | undefined,
  pricing: BraceletPricingBreakdown,
  beadTypes: BeadTypeEntry[] = [],
): BraceletBuilderSummary {
  const { strandA, strandB } = pricing.strandFit;
  const wristFitA = estimateWristFit(placedA);
  const wristFitB = twinning ? estimateWristFit(placedB) : undefined;
  const wristFitLabel = joinedWristFitLabel(twinning, wristA, wristB);
  const { crystals, charms, spacers, other } = groupByProductKind(pricing);
  const materialSections = buildMaterialSections(pricing, beadTypes);

  const strands = [
    {
      index: 0 as const,
      label: twinning ? BRACELET_COPY.wristTwinA : "Your bracelet",
      wristSizeCm: wristA,
      maxSlots: strandA.maxSlots,
      placedCount: placedA.length,
      usedMm: strandA.usedMm,
      wristCircumferenceMm: strandA.wristCircumferenceMm,
      remainingMm: strandA.remainingMm,
      capacityPercent: strandA.capacityPercent,
      isOverCapacity: strandA.isOverCapacity,
      overCapacityMm: strandA.overCapacityMm,
    },
  ];
  if (twinning && strandB) {
    strands.push({
      index: 1 as const,
      label: BRACELET_COPY.wristTwinB,
      wristSizeCm: wristB,
      maxSlots: strandB.maxSlots,
      placedCount: placedB.length,
      usedMm: strandB.usedMm,
      wristCircumferenceMm: strandB.wristCircumferenceMm,
      remainingMm: strandB.remainingMm,
      capacityPercent: strandB.capacityPercent,
      isOverCapacity: strandB.isOverCapacity,
      overCapacityMm: strandB.overCapacityMm,
    });
  }

  return {
    strands,
    twinning,
    wristFit: wristFitA,
    wristFitA,
    wristFitB,
    selectedSizeOfferKey,
    selectedSizeLabel,
    materialSections,
    crystals,
    charms,
    spacers,
    other,
    pricing,
    configSummary: formatBraceletConfigSummary(twinning, wristA, wristB, pricing, wristFitLabel),
  };
}
