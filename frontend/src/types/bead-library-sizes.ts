/** Admin/API payload for one enabled size on a bead library. */
export interface BeadLibrarySizeInput {
  sizeMm: number;
  unitPrice: number;
  isDefault?: boolean;
}

/** Draft row in the bead create/edit form. */
export interface BeadSizeDraftRow {
  sizeMm: number;
  label: string;
  enabled: boolean;
  unitPrice: number;
}

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
