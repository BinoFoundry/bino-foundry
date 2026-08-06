import type {
  BraceletBeadSizeMm,
  BraceletPricingBreakdown,
  BraceletPricingLineItem,
  BraceletStrandFitMetrics,
} from "@bino-foundry/shared/types";

import { placedBeadSizeMm, type PlacedBead } from "@/lib/luxe-data";
import { displayBeadSizeLabel } from "@/lib/bead-size-format";
import type { BeadTypeEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

import { buildStrandFitMetrics, maxStrandSlots, MIN_BEAD_SIZE_MM } from "./capacity";
import { minActiveOfferSizeMm } from "./library-sizes";

type PricingLineItemLabel = Pick<
  BraceletPricingLineItem,
  "beadName" | "sizeLabel" | "beadSizeMm" | "quantity"
>;

/** Customer-facing label: bead name, size, and optional quantity. */
export function formatPricingLineItemLabel(item: PricingLineItemLabel): string {
  const size = displayBeadSizeLabel(item.beadSizeMm);
  const descriptor = `${item.beadName} (${size})`;
  return item.quantity > 1 ? `${descriptor} × ${item.quantity}` : descriptor;
}

function aggregateLineItems(items: BraceletPricingLineItem[]): BraceletPricingLineItem[] {
  const map = new Map<string, BraceletPricingLineItem>();
  for (const item of items) {
    const key = item.offerKey;
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
  beadTypes: BeadTypeEntry[],
  currencyCode: string,
  beadLibrarySizes: BeadLibrarySizeOffer[],
): BraceletPricingBreakdown {
  const minMm = minActiveOfferSizeMm(beadLibrarySizes);
  const strandA: BraceletStrandFitMetrics = buildStrandFitMetrics(wristA, placedA, minMm);
  const strandB: BraceletStrandFitMetrics | undefined = twinning
    ? buildStrandFitMetrics(wristB, placedB, minMm)
    : undefined;
  const totalMaxSlots = strandA.placedCount + (strandB?.placedCount ?? 0);

  const rawItems: BraceletPricingLineItem[] = [];
  const allPlaced = [...placedA, ...(twinning ? placedB : [])];

  for (const placed of allPlaced) {
    const unit = placed.size.unitPrice;
    rawItems.push({
      beadLibraryId: placed.bead.id,
      beadSizeMm: placedBeadSizeMm(placed) as BraceletBeadSizeMm,
      offerKey: placed.size.offerKey,
      beadName: placed.bead.name,
      sizeLabel: displayBeadSizeLabel(placed.size.sizeMm, placed.size.label),
      beadTypeSlug: placed.bead.beadTypeSlug ?? "crystal",
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
    capacityCount: allPlaced.length,
    strandFit: {
      strandA,
      strandB,
      totalMaxSlots,
    },
    subtotal,
    preparationLineItem: null,
    preparationSubtotal: 0,
    total: subtotal,
  };
}
