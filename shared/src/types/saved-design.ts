/** Unified saved design types across all Bino Foundry builders. */

export type DesignProductType = "bracelet" | "sunglasses";

export type SavedDesignStatus = "draft" | "saved" | "ordered" | "archived";

export type CustomerOrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export const CUSTOMER_ORDER_STATUSES: readonly CustomerOrderStatus[] = [
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/** Status timeline shown to customers (excludes cancelled). */
export const CUSTOMER_ORDER_STATUS_FLOW: readonly CustomerOrderStatus[] = [
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
] as const;

export interface OrderSnapshotBeadItem {
  strandIndex: 0 | 1;
  slotPosition: number;
  beadLibraryId: string;
  beadName: string;
  beadTypeSlug?: string;
  beadSizeMm: number;
  sizeLabel: string;
  unitPrice: number;
}

export interface OrderSnapshotPreparation {
  optionId: string;
  optionSlug: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  priceType: string;
}

export interface OrderSnapshotBracelet {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  items: OrderSnapshotBeadItem[];
  preparation: OrderSnapshotPreparation | null;
  beadSubtotal: number;
  preparationSubtotal: number;
}

export interface OrderSnapshotSunglasses {
  frameId: string;
  frameName: string;
  lensTintId: string;
  lensTintName: string;
  selectedOptions: Record<string, boolean>;
  subtotal: number;
}

/** Immutable order BOM frozen at checkout. */
export interface OrderSnapshot {
  version: 1;
  productType: DesignProductType;
  designId: string;
  designTitle: string | null;
  previewThumbnailUrl: string | null;
  currencyCode: string;
  beadSubtotal: number;
  preparationSubtotal: number;
  totalAmount: number;
  customerNotes: string | null;
  bracelet?: OrderSnapshotBracelet;
  sunglasses?: OrderSnapshotSunglasses;
}

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

export interface CustomerOrderDetail extends CustomerOrderSummary {
  customerDetails: CustomerCheckoutDetails & { notes?: string | null };
  snapshot: OrderSnapshot | null;
  updatedAt: string;
  statusUpdatedAt?: string;
}

export interface AdminOrderSummary {
  id: string;
  status: CustomerOrderStatus;
  totalAmount: number;
  currencyCode: string;
  designId: string | null;
  designTitle: string | null;
  productType: DesignProductType | null;
  customerName: string | null;
  customerEmail: string | null;
  userId: string;
  createdAt: string;
  statusUpdatedAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  customerDetails: CustomerCheckoutDetails & { notes?: string | null };
  snapshot: OrderSnapshot | null;
  previewThumbnailUrl: string | null;
  internalNotes: string | null;
  updatedAt: string;
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
  /** How We Prepare selection at checkout (bracelet only). */
  preparation?: {
    optionSlug: string;
    quantity: number;
  };
}
