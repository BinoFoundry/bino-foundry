import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";

import { DEFAULT_TINT, guessTintFromLabel } from "../tint/presets";
import type { SunglassesCompositorConfig, TintGradient } from "../types";

export interface CatalogueLensColor {
  id: string;
  name: string;
  image: string;
}

export function lensColorToTint(lens: CatalogueLensColor): TintGradient {
  if (lens.id === "clear" || lens.name.toLowerCase() === "original") {
    return { name: "Original", top: "#e2e8f0", bottom: "#cbd5e1" };
  }
  return guessTintFromLabel(lens.name);
}

/**
 * Maps catalogue frame + lens picker into compositor config (vector, raster, or hybrid).
 */
export function buildCompositorConfigFromCatalogue(
  frame: FrameOption,
  lens: CatalogueLensColor,
  overrides?: Partial<SunglassesCompositorConfig>,
): SunglassesCompositorConfig {
  const tint = lensColorToTint(lens);
  const frameImage = frame.frameImages?.[0];
  const hasLensRaster = lens.id !== "clear" && Boolean(lens.image);
  const hasFrameRaster = Boolean(frameImage);

  const base: SunglassesCompositorConfig = {
    basePrice: frame.price ?? FRAME_BASE_PRICE,
    frameLabel: frame.name,
    tint: hasLensRaster ? { ...tint, name: lens.name } : tint,
    options: { polarized: false, prescription: false },
    raster: hasFrameRaster || hasLensRaster
      ? {
          frameImageUrl: hasLensRaster ? undefined : frameImage,
          lensImageUrl: hasLensRaster ? lens.image : undefined,
          useGradientOverlay: !hasLensRaster && hasFrameRaster && lens.id !== "clear",
        }
      : undefined,
  };

  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    tint: { ...base.tint, ...overrides.tint },
    options: { ...base.options, ...overrides.options },
    raster: overrides.raster ?? base.raster,
  };
}
