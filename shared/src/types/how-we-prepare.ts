/** Bracelet preparation options ("How We Prepare") before checkout. */

export type HowWePrepareStatus = "active" | "inactive";

export type HowWePreparePriceType = "fixed" | "per_bracelet" | "per_quantity";

export interface HowWePrepareOption {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  optionType: string;
  priceType: HowWePreparePriceType;
  price: number;
  priceLabel: string;
  defaultQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number;
  quantityEnabled: boolean;
  benefits: string[];
  highlightTitle: string;
  highlightDescription: string;
  badge: string | null;
  status: HowWePrepareStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BraceletPreparationSelection {
  optionSlug: string;
  quantity: number;
}

export interface BraceletPreparationLineItem {
  slug: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  priceType: HowWePreparePriceType;
}
