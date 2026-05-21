import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";
import type { FrameRenderView } from "@/types/frame-rendering";
import type {
  SunglassesCompositorConfig,
  SunglassesRenderOptions,
  TintGradient,
} from "../types";

export interface CustomiserSelection {
  frameSku: Pick<FrameOption, "id" | "name" | "price" | "renderViews">;
  tint: TintGradient;
  options: SunglassesRenderOptions;
}

/** Views with a plate URL (mask optional — canvas pipeline can auto-mask). */
export function buildPlateViewsMap(views: FrameRenderView[] | undefined) {
  if (!views?.length) return undefined;

  const map: NonNullable<SunglassesCompositorConfig["maskedViews"]> = {};
  for (const v of views) {
    if (v.plateUrl) map[v.view] = v;
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

/**
 * Customiser config: masked photo plates when available (bino-rendering), else SVG lens-only mode.
 */
export function buildCustomiserCompositorConfig(selection: CustomiserSelection): SunglassesCompositorConfig {
  const plateViews = buildPlateViewsMap(selection.frameSku.renderViews);
  const base = {
    basePrice: selection.frameSku.price ?? FRAME_BASE_PRICE,
    frameLabel: selection.frameSku.name,
    tint: selection.tint,
    options: selection.options,
  };

  if (plateViews && (plateViews.front || plateViews.side)) {
    return {
      renderMode: "masked-photo",
      ...base,
      maskedViews: plateViews,
    };
  }

  return {
    renderMode: "customiser-dynamic",
    ...base,
    maskedViews: undefined,
    raster: undefined,
  };
}
