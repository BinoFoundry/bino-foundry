import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadVariantEntry } from "@/types/bead-variants";

export function variantsForLibrary(
  variants: BeadVariantEntry[],
  libraryId: string,
): BeadVariantEntry[] {
  return variants
    .filter((v) => v.beadLibraryId === libraryId && v.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeMm - b.sizeMm);
}

export function defaultVariantForLibrary(
  variants: BeadVariantEntry[],
  libraryId: string,
): BeadVariantEntry | undefined {
  const list = variantsForLibrary(variants, libraryId);
  return list.find((v) => v.isDefault) ?? list[0];
}

export function findVariantById(
  variants: BeadVariantEntry[],
  variantId: string,
): BeadVariantEntry | undefined {
  return variants.find((v) => v.id === variantId || v.publicId === variantId);
}

export function formatVariantPrice(variant: BeadVariantEntry, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(variant.unitPrice);
  } catch {
    return `$${variant.unitPrice.toFixed(2)}`;
  }
}

export function variantMatchesLibrary(variant: BeadVariantEntry, bead: BeadLibraryEntry): boolean {
  return variant.beadLibraryId === bead.id;
}
