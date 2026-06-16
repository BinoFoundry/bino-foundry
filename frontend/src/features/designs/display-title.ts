import type { DesignProductType } from "@bino-foundry/shared/types";

const PRODUCT_FALLBACK: Record<DesignProductType, string> = {
  bracelet: "Bracelet",
  sunglasses: "Sunglasses",
};

/** Primary display title for a saved design — uses customer name when set. */
export function formatDesignDisplayTitle(design: {
  title: string | null;
  productType: DesignProductType;
}): string {
  const trimmed = design.title?.trim();
  if (trimmed) return trimmed;
  return PRODUCT_FALLBACK[design.productType] ?? "Design";
}

/** Title sent on save — empty string clears the stored name (stored as null). */
export function resolveBraceletSaveTitle(name: string): string {
  return name.trim();
}
