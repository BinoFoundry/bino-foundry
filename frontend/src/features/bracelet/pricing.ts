import {
  DEFAULT_BRACELET_PRICING_RULES,
  type BraceletBeadSizeMm,
  type BraceletPricingBreakdown,
  type BraceletPricingLineItem,
} from "@bino-foundry/shared/types";

import { calculateBeadCount, type BeadSize, type PlacedBead } from "@/lib/luxe-data";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";

export function sizeMultiplierForMm(beadSizeMm: number, beadSizes?: BeadSizeEntry[]): number {
  const fromDb = beadSizes?.find((s) => s.sizeMm === beadSizeMm && s.isActive !== false);
  return fromDb?.priceMultiplier ?? 1;
}

function beadTypeUsesSizePricing(beadTypes: BeadTypeEntry[], slug: string): boolean {
  const type = beadTypes.find((t) => t.slug === slug);
  if (type && typeof type.usesSizePricing === "boolean") return type.usesSizePricing;
  return DEFAULT_BRACELET_PRICING_RULES.sizePricedTypeSlugs.includes(slug);
}

export function calculateUnitPrice(
  bead: BeadLibraryEntry,
  beadSizeMm: BraceletBeadSizeMm,
  beadTypes: BeadTypeEntry[],
  beadSizes?: BeadSizeEntry[],
): number {
  const base = bead.price;
  const slug = bead.beadTypeSlug ?? "crystal";
  if (!beadTypeUsesSizePricing(beadTypes, slug)) return base;
  return base * sizeMultiplierForMm(beadSizeMm, beadSizes);
}

function aggregateLineItems(items: BraceletPricingLineItem[]): BraceletPricingLineItem[] {
  const map = new Map<string, BraceletPricingLineItem>();
  for (const item of items) {
    const key = `${item.beadLibraryId}|${item.beadSizeMm}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.lineTotal += item.lineTotal;
    } else {
      map.set(key, { ...item, quantity: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.lineTotal - a.lineTotal);
}

export function buildBraceletPricing(
  placedA: PlacedBead[],
  placedB: PlacedBead[],
  twinning: boolean,
  wristA: number,
  wristB: number,
  defaultSize: BeadSize,
  currencyCode: string,
  beadTypes: BeadTypeEntry[],
  beadSizes?: BeadSizeEntry[],
): BraceletPricingBreakdown {
  const capacityA = calculateBeadCount(wristA, defaultSize);
  const capacityB = twinning ? calculateBeadCount(wristB, defaultSize) : 0;
  const capacityCount = capacityA + capacityB;

  const rawItems: BraceletPricingLineItem[] = [];
  const allPlaced = [...placedA, ...(twinning ? placedB : [])];

  for (const placed of allPlaced) {
    const unit = calculateUnitPrice(placed.bead, placed.beadSize, beadTypes, beadSizes);
    rawItems.push({
      beadLibraryId: placed.bead.id,
      beadName: placed.bead.name,
      beadTypeSlug: placed.bead.beadTypeSlug ?? "crystal",
      beadSizeMm: placed.beadSize as BraceletBeadSizeMm,
      quantity: 1,
      unitPrice: unit,
      lineTotal: unit,
    });
  }

  const lineItems = aggregateLineItems(rawItems);
  const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);

  const typeName = (slug: string) => beadTypes.find((t) => t.slug === slug)?.name ?? slug;

  const byTypeMap = new Map<string, { slug: string; name: string; quantity: number; subtotal: number }>();
  for (const item of lineItems) {
    const cur = byTypeMap.get(item.beadTypeSlug);
    if (cur) {
      cur.quantity += item.quantity;
      cur.subtotal += item.lineTotal;
    } else {
      byTypeMap.set(item.beadTypeSlug, {
        slug: item.beadTypeSlug,
        name: typeName(item.beadTypeSlug),
        quantity: item.quantity,
        subtotal: item.lineTotal,
      });
    }
  }

  return {
    currencyCode,
    lineItems,
    byType: [...byTypeMap.values()].sort((a, b) => b.subtotal - a.subtotal),
    placedCount: allPlaced.length,
    capacityCount,
    subtotal,
    total: subtotal,
  };
}
