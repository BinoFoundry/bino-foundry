/** Sellable size/price variant (references one bead_libraries asset). */
export interface BeadVariantEntry {
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
  createdAt?: string;
  updatedAt?: string;
}
