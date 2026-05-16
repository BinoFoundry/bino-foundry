import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";

import type {
  FrameColorSelection,
  SunglassesCompositorConfig,
  SunglassesRenderOptions,
  TintGradient,
} from "../types";

export interface CustomiserSelection {
  frameSku: Pick<FrameOption, "id" | "name" | "price">;
  frameColor: FrameColorSelection;
  tint: TintGradient;
  options: SunglassesRenderOptions;
}

/** Project-brief customiser: dynamic lens-only compositing (no pre-rendered tint/frame composites). */
export function buildCustomiserCompositorConfig(selection: CustomiserSelection): SunglassesCompositorConfig {
  return {
    renderMode: "customiser-dynamic",
    basePrice: selection.frameSku.price ?? FRAME_BASE_PRICE,
    frame: selection.frameColor,
    tint: selection.tint,
    options: selection.options,
    raster: undefined,
  };
}
