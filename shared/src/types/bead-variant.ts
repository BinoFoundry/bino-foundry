/** Sellable size/price variant for a bead library asset (shared crop). */

export interface BeadVariantRef {
  id: string;
  publicId: string;
  beadLibraryId: string;
  sizeMm: number;
  unitPrice: number;
  currencyCode?: string;
  label: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}
