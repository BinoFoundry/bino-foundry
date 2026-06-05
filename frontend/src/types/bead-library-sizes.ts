/** Enabled size + price for one bead library (junction with global bead_sizes). */
export interface BeadLibrarySizeOffer {
  id: string;
  beadLibraryId: string;
  beadSizeId: string;
  sizeMm: number;
  label: string;
  unitPrice: number;
  offerKey: string;
  isDefault?: boolean;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}
