/** Bracelet builder / checkout configuration (relational + minimal render refs). */

export const BRACELET_CONFIG_VERSION = 3 as const;

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
  beadSizeMm: BraceletBeadSizeMm;
  /** Stable key `${beadLibraryId}-${sizeMm}` for aggregation. */
  offerKey: string;
  beadName: string;
  sizeLabel: string;
  beadTypeSlug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Wrist-fit metrics for one strand (mixed bead sizes). */
export interface BraceletStrandFitMetrics {
  /** Selected wrist target (mm). */
  wristCircumferenceMm: number;
  /** Sum of placed bead diameters (mm). */
  usedMm: number;
  /** Target minus used; negative when over capacity. */
  remainingMm: number;
  /** Used / target as 0–100+ (can exceed 100). */
  capacityPercent: number;
  isOverCapacity: boolean;
  overCapacityMm: number;
  maxSlots: number;
  placedCount: number;
}

export interface BraceletPricingBreakdown {
  currencyCode: string;
  lineItems: BraceletPricingLineItem[];
  byType: { slug: string; name: string; quantity: number; subtotal: number }[];
  placedCount: number;
  /** @deprecated Use strandFit.totalMaxSlots — max discrete slots at smallest catalog mm. */
  capacityCount: number;
  /** Per-strand wrist fit (sum of item mm vs wrist circumference). */
  strandFit: {
    strandA: BraceletStrandFitMetrics;
    strandB?: BraceletStrandFitMetrics;
    totalMaxSlots: number;
  };
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
  /** Optional placement default for new beads (not used for strand fit). */
  defaultBeadSizeMm?: BraceletBeadSizeMm;
  items: BraceletConfigurationItemRef[];
  pricing: BraceletPricingBreakdown;
  /** ISO timestamp when snapshot was taken. */
  updatedAt: string;
}

export interface BraceletStrandSummary {
  index: 0 | 1;
  label: string;
  wristSizeCm: number;
  maxSlots: number;
  placedCount: number;
  usedMm: number;
  wristCircumferenceMm: number;
  remainingMm: number;
  capacityPercent: number;
  isOverCapacity: boolean;
  overCapacityMm: number;
}

export interface BraceletMaterialSection {
  title: string;
  slug: string;
  rows: { name: string; quantity: number; subtotal: number }[];
}

/** Estimated wrist circumference range from bead composition (cm). */
export interface BraceletWristFitEstimate {
  minCm: number;
  maxCm: number;
  lengthMm: number;
  beadCount: number;
}

export interface BraceletBuilderSummary {
  strands: BraceletStrandSummary[];
  twinning: boolean;
  /** Primary display fit for strand A (kept for backwards compatibility). */
  wristFit: BraceletWristFitEstimate;
  /** Per-bracelet fit estimates; independent in matching mode. */
  wristFitA: BraceletWristFitEstimate;
  wristFitB?: BraceletWristFitEstimate;
  /** Size offer key (`libraryId-mm`) selected when placing from the library. */
  selectedSizeOfferKey: string | null;
  selectedSizeLabel?: string;
  /** Grouped by admin bead type (display order). */
  materialSections: BraceletMaterialSection[];
  crystals: { name: string; quantity: number; subtotal: number }[];
  charms: { name: string; quantity: number; subtotal: number }[];
  spacers: { name: string; quantity: number; subtotal: number }[];
  other: { name: string; quantity: number; subtotal: number }[];
  pricing: BraceletPricingBreakdown;
  configSummary: string;
}
