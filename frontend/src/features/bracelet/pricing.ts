import {
  DEFAULT_BRACELET_PRICING_RULES,
  type BraceletBeadSizeMm,
  type BraceletPricingBreakdown,
  type BraceletPricingLineItem,
  type BraceletPricingRules,
} from "@bino-foundry/shared/types";

import { calculateBeadCount, type BeadSize, type PlacedBead } from "@/lib/luxe-data";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";

export function parseBraceletPricingRules(raw: unknown): BraceletPricingRules {
  if (!raw || typeof raw !== "object") return DEFAULT_BRACELET_PRICING_RULES;
  const o = raw as Record<string, unknown>;
  const mult = o.sizeMultipliers;
  const slugs = o.sizePricedTypeSlugs;
  return {
    sizeMultipliers:
      mult && typeof mult === "object"
        ? Object.fromEntries(
            Object.entries(mult as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 1]),
          )
        : DEFAULT_BRACELET_PRICING_RULES.sizeMultipliers,
    sizePricedTypeSlugs: Array.isArray(slugs)
      ? slugs.map(String)
      : DEFAULT_BRACELET_PRICING_RULES.sizePricedTypeSlugs,
    currencyCode:
      typeof o.currencyCode === "string" ? o.currencyCode : DEFAULT_BRACELET_PRICING_RULES.currencyCode,
  };
}

export function sizeMultiplierForMm(
  beadSizeMm: number,
  rules: BraceletPricingRules,
  beadSizes?: BeadSizeEntry[],
): number {
  const fromDb = beadSizes?.find((s) => s.sizeMm === beadSizeMm && s.isActive !== false);
  if (fromDb) return fromDb.priceMultiplier;
  return rules.sizeMultipliers[String(beadSizeMm)] ?? 1;
}

export function calculateUnitPrice(
  bead: BeadLibraryEntry,
  beadSizeMm: BraceletBeadSizeMm,
  rules: BraceletPricingRules,
  beadSizes?: BeadSizeEntry[],
): number {
  const base = bead.price;
  const slug = bead.beadTypeSlug ?? "crystal";
  if (!rules.sizePricedTypeSlugs.includes(slug)) return base;
  return base * sizeMultiplierForMm(beadSizeMm, rules, beadSizes);
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
  rules: BraceletPricingRules,
  beadTypes: BeadTypeEntry[],
  beadSizes?: BeadSizeEntry[],
): BraceletPricingBreakdown {
  const capacityA = calculateBeadCount(wristA, defaultSize);
  const capacityB = twinning ? calculateBeadCount(wristB, defaultSize) : 0;
  const capacityCount = capacityA + capacityB;

  const rawItems: BraceletPricingLineItem[] = [];
  const allPlaced = [...placedA, ...(twinning ? placedB : [])];

  for (const placed of allPlaced) {
    const unit = calculateUnitPrice(placed.bead, placed.beadSize, rules, beadSizes);
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
    currencyCode: rules.currencyCode,
    lineItems,
    byType: [...byTypeMap.values()].sort((a, b) => b.subtotal - a.subtotal),
    placedCount: allPlaced.length,
    capacityCount,
    subtotal,
    total: subtotal,
  };
}
