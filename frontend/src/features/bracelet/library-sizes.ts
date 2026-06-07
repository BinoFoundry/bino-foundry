import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeInput, BeadLibrarySizeOffer } from "@/types/bead-library-sizes";

export function sizesForLibrary(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
): BeadLibrarySizeOffer[] {
  return offers
    .filter((o) => o.beadLibraryId === libraryId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeMm - b.sizeMm);
}

export function defaultSizeForLibrary(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
): BeadLibrarySizeOffer | undefined {
  const list = sizesForLibrary(offers, libraryId);
  return list.find((o) => o.isDefault) ?? list[0];
}

export function findSizeOffer(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
  sizeMm: number,
): BeadLibrarySizeOffer | undefined {
  return offers.find((o) => o.beadLibraryId === libraryId && o.sizeMm === sizeMm);
}

/** Resolve by offer key (`libraryPublicId-mm`) or legacy variant public id. */
export function findSizeOfferByKey(
  offers: BeadLibrarySizeOffer[],
  key: string,
): BeadLibrarySizeOffer | undefined {
  const direct = offers.find((o) => o.offerKey === key || o.id === key);
  if (direct) return direct;
  const m = key.match(/^(.+)-(\d+)$/);
  if (!m) return undefined;
  const libraryId = m[1];
  const sizeMm = Number(m[2]);
  return findSizeOffer(offers, libraryId, sizeMm);
}

export function minActiveOfferSizeMm(offers: BeadLibrarySizeOffer[]): number {
  const active = offers.map((o) => o.sizeMm);
  return active.length ? Math.min(...active) : 4;
}

export function formatSizeOfferPrice(offer: BeadLibrarySizeOffer, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(offer.unitPrice);
  } catch {
    return `$${offer.unitPrice.toFixed(2)}`;
  }
}

export function sizeOfferMatchesLibrary(offer: BeadLibrarySizeOffer, bead: BeadLibraryEntry): boolean {
  return offer.beadLibraryId === bead.id;
}

/** Human-readable price label for admin lists (from size offers only). */
export function formatLibraryPriceRange(
  offers: BeadLibrarySizeOffer[],
  libraryId: string,
): string {
  const sizes = sizesForLibrary(offers, libraryId);
  if (!sizes.length) return "No sizes priced";
  const prices = sizes.map((s) => s.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)}–$${max.toFixed(2)}`;
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
