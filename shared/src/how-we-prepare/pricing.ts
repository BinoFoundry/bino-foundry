import type {
  BraceletPreparationLineItem,
  BraceletPreparationSelection,
  HowWePrepareOption,
  HowWePreparePriceType,
} from "../types/how-we-prepare.js";

export interface ApplyPreparationPricingInput {
  beadSubtotal: number;
  twinning: boolean;
  options: HowWePrepareOption[];
  selection: BraceletPreparationSelection | null;
}

export interface ApplyPreparationPricingResult {
  preparationLineItem: BraceletPreparationLineItem | null;
  preparationSubtotal: number;
  subtotal: number;
  total: number;
}

function braceletCount(twinning: boolean): number {
  return twinning ? 2 : 1;
}

function activeOptions(options: HowWePrepareOption[]): HowWePrepareOption[] {
  return [...options]
    .filter((o) => o.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export function defaultPreparationSelection(
  options: HowWePrepareOption[],
): BraceletPreparationSelection | null {
  const first = activeOptions(options)[0];
  if (!first) return null;
  return {
    optionSlug: first.slug,
    quantity: first.quantityEnabled ? first.defaultQuantity : 1,
  };
}

function clampQuantity(option: HowWePrepareOption, quantity: number): number {
  if (!option.quantityEnabled) return 1;
  return Math.min(option.maximumQuantity, Math.max(option.minimumQuantity, quantity));
}

function lineQuantity(
  option: HowWePrepareOption,
  selectionQty: number,
  bracelets: number,
  priceType: HowWePreparePriceType,
): number {
  const qty = clampQuantity(option, selectionQty);
  if (priceType === "per_bracelet") return bracelets;
  if (priceType === "per_quantity") return qty;
  return 1;
}

export function applyPreparationPricing(
  input: ApplyPreparationPricingInput,
): ApplyPreparationPricingResult {
  const beadSubtotal = input.beadSubtotal;
  const bracelets = braceletCount(input.twinning);

  if (!input.selection) {
    return {
      preparationLineItem: null,
      preparationSubtotal: 0,
      subtotal: beadSubtotal,
      total: beadSubtotal,
    };
  }

  const option = input.options.find(
    (o) => o.slug === input.selection!.optionSlug && o.status === "active",
  );
  if (!option) {
    return {
      preparationLineItem: null,
      preparationSubtotal: 0,
      subtotal: beadSubtotal,
      total: beadSubtotal,
    };
  }

  const quantity = lineQuantity(option, input.selection.quantity, bracelets, option.priceType);
  const lineTotal = option.price * quantity;

  const preparationLineItem: BraceletPreparationLineItem = {
    slug: option.slug,
    name: option.name,
    quantity,
    unitPrice: option.price,
    lineTotal,
    priceType: option.priceType,
  };

  return {
    preparationLineItem,
    preparationSubtotal: lineTotal,
    subtotal: beadSubtotal,
    total: beadSubtotal + lineTotal,
  };
}

export function resolvePreparationSelection(
  options: HowWePrepareOption[],
  selection: BraceletPreparationSelection | null,
): BraceletPreparationSelection | null {
  const active = activeOptions(options);
  if (active.length === 0) return null;

  const current = selection
    ? active.find((o) => o.slug === selection.optionSlug)
    : undefined;
  const option = current ?? active[0]!;

  return {
    optionSlug: option.slug,
    quantity: option.quantityEnabled
      ? clampQuantity(option, selection?.quantity ?? option.defaultQuantity)
      : 1,
  };
}
