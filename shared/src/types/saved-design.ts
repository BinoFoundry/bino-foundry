/** Unified saved design types across all Bino Foundry builders. */

export type DesignProductType = "bracelet" | "sunglasses";

export type SavedDesignStatus = "draft" | "saved" | "ordered" | "archived";

export type CustomerOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "cancelled";

export interface SavedDesignSummary {
  id: string;
  productType: DesignProductType;
  status: SavedDesignStatus;
  title: string | null;
  subtotal: number;
  currencyCode: string;
  productConfigId: string;
  orderReference: string | null;
  previewThumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SunglassesConfigurationPayload {
  frameId: string;
  lensTintId: string;
  selectedOptions: Record<string, boolean>;
  builderStep?: "frame" | "lens" | "rx" | "extras" | "preview";
  subtotal?: number;
  currencyCode?: string;
}

export interface SaveDesignRequest {
  productType: DesignProductType;
  title?: string;
  status?: "draft" | "saved";
  /** When set, updates an existing saved design entry. */
  designId?: string;
  /** Client-generated JPEG/PNG/WebP data URL for My Designs preview. */
  previewThumbnailDataUrl?: string;
  bracelet?: {
    twinning: boolean;
    wristSizeCmA: number;
    wristSizeCmB: number;
    items: {
      strandIndex: 0 | 1;
      slotPosition: number;
      beadLibraryId: string;
      beadSizeMm: number;
    }[];
  };
  sunglasses?: SunglassesConfigurationPayload;
}

/** Result of POST /designs/bulk-delete (also shapes single-delete internals). */
export interface BulkDeleteDesignsResult {
  deleted: number;
  failed: number;
  skipped: number;
  deletedIds: string[];
  failedIds: string[];
  skippedIds: string[];
}

export interface CustomerOrderSummary {
  id: string;
  status: CustomerOrderStatus;
  totalAmount: number;
  currencyCode: string;
  designId: string;
  designTitle: string | null;
  productType: DesignProductType | null;
  previewThumbnailUrl: string | null;
  createdAt: string;
}

export interface CustomerCheckoutDetails {
  fullName: string;
  email: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderRequest {
  designId: string;
  customerDetails: CustomerCheckoutDetails;
  notes?: string;
}
