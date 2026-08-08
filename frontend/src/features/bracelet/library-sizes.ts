import { formatCurrency, formatCurrencyRange } from "@bino-foundry/shared/currency";

import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeInput, BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

export function isSizeAvailableForNew(offer: BeadLibrarySizeOffer): boolean {
  return offer.availableForNew !== false;
}

export function sizesForLibrary(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
  options?: { includeUnavailable?: boolean },
): BeadLibrarySizeOffer[] {
  return offers
    .filter((o) => o.beadLibraryId === libraryId)
    .filter((o) => options?.includeUnavailable || isSizeAvailableForNew(o))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeMm - b.sizeMm);
}

/** All junction rows for admin editors (including soft-disabled sizes). */
export function allSizesForLibrary(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
): BeadLibrarySizeOffer[] {
  return sizesForLibrary(offers, libraryId, { includeUnavailable: true });
}

export function defaultSizeForLibrary(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
): BeadLibrarySizeOffer | undefined {
  const list = sizesForLibrary(offers, libraryId);
  return list.find((o) => o.isDefault) ?? list[0];
}

/**
 * Keep an explicit size selection when valid for the bead; otherwise fall back to default.
 * Used so mobile size-filter picks are not overwritten by the default offer.
 */
export function resolveSelectedSizeOfferKey(
  offers: BeadLibrarySizeOffer[],
  beadLibraryId: string,
  selectedSizeOfferKey: string | null,
): string | undefined {
  const forBead = sizesForLibrary(offers, beadLibraryId);
  const current =
    selectedSizeOfferKey != null
      ? forBead.find((o) => o.offerKey === selectedSizeOfferKey || o.id === selectedSizeOfferKey)
      : undefined;
  if (current) return current.offerKey;
  return defaultSizeForLibrary(offers, beadLibraryId)?.offerKey;
}

export function findSizeOffer(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
  sizeMm: number,
  options?: { includeUnavailable?: boolean },
): BeadLibrarySizeOffer | undefined {
  return offers.find(
    (o) =>
      o.beadLibraryId === libraryId &&
      o.sizeMm === sizeMm &&
      (options?.includeUnavailable || isSizeAvailableForNew(o)),
  );
}

/** Resolve by offer key (`libraryPublicId-mm`) or legacy variant public id. */
export function findSizeOfferByKey(
  offers: BeadLibrarySizeOffer[],
  key: string,
  options?: { includeUnavailable?: boolean },
): BeadLibrarySizeOffer | undefined {
  const direct = offers.find(
    (o) =>
      (o.offerKey === key || o.id === key) &&
      (options?.includeUnavailable || isSizeAvailableForNew(o)),
  );
  if (direct) return direct;
  const m = key.match(/^(.+)-(\d+)$/);
  if (!m) return undefined;
  const libraryId = m[1];
  const sizeMm = Number(m[2]);
  return findSizeOffer(offers, libraryId, sizeMm, options);
}

export function minActiveOfferSizeMm(offers: BeadLibrarySizeOffer[]): number {
  const active = offers.filter(isSizeAvailableForNew).map((o) => o.sizeMm);
  return active.length ? Math.min(...active) : 1;
}

function coerceUnitPrice(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatSizeOfferPrice(offer: BeadLibrarySizeOffer, currency: string): string {
  const price = coerceUnitPrice(offer.unitPrice);
  if (price === null) return "—";
  return formatCurrency(price, currency);
}

export function sizeOfferMatchesLibrary(offer: BeadLibrarySizeOffer, bead: BeadLibraryEntry): boolean {
  return offer.beadLibraryId === bead.id;
}

/** Human-readable price label for admin lists (from size offers only). */
export function formatLibraryPriceRange(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
  currency: string,
): string {
  const prices = sizesForLibrary(offers, libraryId)
    .map((s) => coerceUnitPrice(s.unitPrice))
    .filter((p): p is number => p !== null);
  if (!prices.length) return "No sizes priced";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return formatCurrencyRange(min, max, currency);
}

export function draftRowsToSizeInputs(
  rows: { sizeMm: number; enabled: boolean; unitPrice: number }[],
): BeadLibrarySizeInput[] {
  const enabled = rows.filter((r) => r.enabled);
  return enabled.map((r, i) => ({
    sizeMm: r.sizeMm,
    unitPrice: r.unitPrice,
    isDefault: i === 0,
  }));
}
