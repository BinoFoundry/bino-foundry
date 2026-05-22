import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";
import type { FrameRenderView } from "@/types/frame-rendering";
import { isFrameViewClipReady } from "@/render/lens-clip";
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

/** Views with plate + ready SVG clip paths. */
export function buildClipViewsMap(views: FrameRenderView[] | undefined) {
  if (!views?.length) return undefined;

  const map: NonNullable<SunglassesCompositorConfig["clipViews"]> = {};
  for (const v of views) {
    if (v.plateUrl && isFrameViewClipReady(v)) map[v.view] = v;
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

/**
 * Customiser config: SVG clipPath tint on photo plates when ready, else SVG lens-only demo.
 */
export function buildCustomiserCompositorConfig(selection: CustomiserSelection): SunglassesCompositorConfig {
  const clipViews = buildClipViewsMap(selection.frameSku.renderViews);
  const base = {
    basePrice: selection.frameSku.price ?? FRAME_BASE_PRICE,
    frameLabel: selection.frameSku.name,
    tint: selection.tint,
    options: selection.options,
  };

  if (clipViews && (clipViews.front || clipViews.side || clipViews.three_quarter)) {
    return {
      renderMode: "svg-clip",
      ...base,
      clipViews,
      maskedViews: clipViews,
    };
  }

  return {
    renderMode: "customiser-dynamic",
    ...base,
    clipViews: undefined,
    maskedViews: undefined,
    raster: undefined,
  };
}
