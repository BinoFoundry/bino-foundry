import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import type { SunglassesRenderOptions } from "../types";

export function createDefaultRenderOptions(
  builderOptions: BuilderOptionEntry[],
): SunglassesRenderOptions {
  return Object.fromEntries(builderOptions.map((o) => [o.code, false]));
}

export function calculateSunglassesTotal(
  basePrice: number,
  selectedOptions: SunglassesRenderOptions,
  builderOptions: BuilderOptionEntry[],
  selectedTint?: Pick<LensTintEntry, "priceSurcharge"> | null,
): number {
  let total = basePrice;
  if (selectedTint?.priceSurcharge) {
    total += selectedTint.priceSurcharge;
  }
  for (const option of builderOptions) {
    if (!option.isActive) continue;
    if (selectedOptions[option.code]) {
      total += option.priceSurcharge;
    }
  }
  return total;
}

export function hasManualFollowUpSelected(
  selectedOptions: SunglassesRenderOptions,
  builderOptions: BuilderOptionEntry[],
): boolean {
  return builderOptions.some(
    (o) => o.isActive && o.requiresManualFollowUp && Boolean(selectedOptions[o.code]),
  );
}

export function formatConfigSummary(frameName: string, tintName: string): string {
  return `${frameName} Frame • ${tintName}`;
}
