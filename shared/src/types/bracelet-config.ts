/** Bracelet builder / checkout configuration (relational + minimal render refs). */

export const BRACELET_CONFIG_VERSION = 1 as const;

/** Millimeters — options loaded from `bead_sizes` table. */
export type BraceletBeadSizeMm = number;

export type BraceletConfigStatus = "draft" | "saved" | "ordered" | "archived";

/** Size multipliers — loaded from config_kv, with these defaults. */
export interface BraceletPricingRules {
  sizeMultipliers: Record<string, number>;
  /** Slugs that use size multipliers (others use flat unit_price). */
  sizePricedTypeSlugs: string[];
  currencyCode: string;
}

export const DEFAULT_BRACELET_PRICING_RULES: BraceletPricingRules = {
  sizeMultipliers: { "6": 0.8, "8": 1, "10": 1.3 },
  sizePricedTypeSlugs: ["crystal", "accent"],
  currencyCode: "USD",
};

/** One placed item on a strand (IDs only — no asset blobs). */
export interface BraceletConfigurationItemRef {
  strandIndex: 0 | 1;
  slotPosition: number;
  beadLibraryId: string;
  beadSizeMm: BraceletBeadSizeMm;
}

export interface BraceletPricingLineItem {
  beadLibraryId: string;
  beadName: string;
  beadTypeSlug: string;
  beadSizeMm: BraceletBeadSizeMm;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BraceletPricingBreakdown {
  currencyCode: string;
  lineItems: BraceletPricingLineItem[];
  byType: { slug: string; name: string; quantity: number; subtotal: number }[];
  placedCount: number;
  capacityCount: number;
  subtotal: number;
  total: number;
}

/** Serializable builder state for API / future checkout. */
export interface BraceletConfigurationPayload {
  version: typeof BRACELET_CONFIG_VERSION;
  status: BraceletConfigStatus;
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  defaultBeadSizeMm: BraceletBeadSizeMm;
  items: BraceletConfigurationItemRef[];
  pricing: BraceletPricingBreakdown;
  /** ISO timestamp when snapshot was taken. */
  updatedAt: string;
}

export interface BraceletStrandSummary {
  index: 0 | 1;
  label: string;
  wristSizeCm: number;
  capacity: number;
  placedCount: number;
}

export interface BraceletMaterialSection {
  title: string;
  slug: string;
  rows: { name: string; quantity: number; subtotal: number }[];
}

export interface BraceletBuilderSummary {
  strands: BraceletStrandSummary[];
  twinning: boolean;
  defaultBeadSizeMm: BraceletBeadSizeMm;
  beadSizeLabel?: string;
  /** Grouped by admin bead type (display order). */
  materialSections: BraceletMaterialSection[];
  crystals: { name: string; quantity: number; subtotal: number }[];
  charms: { name: string; quantity: number; subtotal: number }[];
  spacers: { name: string; quantity: number; subtotal: number }[];
  other: { name: string; quantity: number; subtotal: number }[];
  pricing: BraceletPricingBreakdown;
  configSummary: string;
}
