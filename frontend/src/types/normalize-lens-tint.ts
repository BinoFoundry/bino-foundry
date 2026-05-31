import {
  DEFAULT_CLASSIC_LENS_TINT_RENDER,
  DEFAULT_LENS_TINT_RENDER,
  GRADIENT_DIRECTIONS,
  type GradientDirection,
} from "@bino-foundry/shared/types";

import type { LensTintEntry, SunglassesCatalogSnapshot } from "./sunglasses-catalog";

export function normalizeLensTintEntry(raw: LensTintEntry): LensTintEntry {
  const category = raw.category === "classic" ? "classic" : "gradient";
  const defaults = category === "classic" ? DEFAULT_CLASSIC_LENS_TINT_RENDER : DEFAULT_LENS_TINT_RENDER;
  const direction = GRADIENT_DIRECTIONS.includes(raw.gradientDirection as GradientDirection)
    ? raw.gradientDirection
    : defaults.gradientDirection;

  return {
    ...raw,
    category,
    gradientTop: raw.gradientTop || defaults.gradientTop,
    gradientBottom:
      category === "classic" ? raw.gradientTop || defaults.gradientTop : raw.gradientBottom || defaults.gradientBottom,
    opacity: typeof raw.opacity === "number" ? raw.opacity : defaults.opacity,
    gradientDirection: direction,
    gradientAngle: typeof raw.gradientAngle === "number" ? raw.gradientAngle : defaults.gradientAngle,
    gradientMidPosition:
      typeof raw.gradientMidPosition === "number" ? raw.gradientMidPosition : defaults.gradientMidPosition,
    gradientIntensity:
      typeof raw.gradientIntensity === "number" ? raw.gradientIntensity : defaults.gradientIntensity,
  };
}

export function normalizeSunglassesCatalog(data: SunglassesCatalogSnapshot): SunglassesCatalogSnapshot {
  return {
    ...data,
    lensTints: data.lensTints.map(normalizeLensTintEntry),
  };
}
