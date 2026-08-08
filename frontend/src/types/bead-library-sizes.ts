import type { BeadDeliveryUrls } from "@bino-foundry/shared/types";

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
  /** How many saved bracelet designs currently reference this size offer. */
  designReferenceCount?: number;
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
  /**
   * When false, kept for existing designs/orders but hidden from new builder selections.
   * Defaults to true when omitted (legacy API rows).
   */
  availableForNew?: boolean;
  /** Distinct saved bracelet configurations that reference this junction row. */
  designReferenceCount?: number;
  /** group_reference / asset_visible — legacy runtime factor metadata. */
  normalizationFactor?: number;
  assetVisibleDiameterPx?: number | null;
  groupReferenceDiameterPx?: number | null;
  /** Save-time normalized export for this mm group. */
  normalizedProcessedImageUrl?: string;
  normalizedDeliveryUrls?: BeadDeliveryUrls | null;
  normalizedVisibleDiameterPx?: number | null;
  needsNormalizedReexport?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
