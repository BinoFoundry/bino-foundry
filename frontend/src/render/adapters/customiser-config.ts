import type { LensClipRenderSettings, LensRenderingPreset } from "@bino-foundry/shared/types";

import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";
import type { FrameEntry } from "@/data/glasses";
import type { FrameRenderView } from "@/types/frame-rendering";
import { applyLensRenderHierarchyToFrameViews, isFrameViewClipReady } from "@/render/lens-clip";
import type {
  SunglassesCompositorConfig,
  SunglassesRenderOptions,
  TintGradient,
} from "../types";

export interface CustomiserSelection {
  frameSku: Pick<
    FrameOption,
    "id" | "name" | "price" | "renderViews"
  > &
    Partial<Pick<FrameEntry, "lensRenderPresetId" | "useLensRenderPreset">>;
  tint: TintGradient;
  options: SunglassesRenderOptions;
  /** Database presets — when provided, material settings resolve via Override → Preset → Default. */
  lensRenderPresets?: LensRenderingPreset[];
  /** Single database-backed fallback beneath every preset and frame override. */
  lensRenderSystemDefaults?: LensClipRenderSettings | null;
  /** Live draft settings (preset editor). When set, stamped onto every view without Save. */
  renderSettingsOverride?: LensClipRenderSettings | null;
  /**
   * Preview-only: when false, frame glass occluders are stripped for comparison.
   * Never persisted — defaults to showing occluders (true / undefined).
   */
  previewGlassOccludersEnabled?: boolean;
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

function stampRenderOverride(
  views: FrameRenderView[],
  override: LensClipRenderSettings,
): FrameRenderView[] {
  return views.map((view) => {
    if (!view.clipConfig) return view;
    return {
      ...view,
      clipConfig: {
        ...view.clipConfig,
        render: { ...view.clipConfig.render, ...override },
      },
    };
  });
}

function stripGlassOccluders(views: FrameRenderView[]): FrameRenderView[] {
  return views.map((view) => {
    if (!view.clipConfig) return view;
    return {
      ...view,
      clipConfig: {
        ...view.clipConfig,
        frameExclusions: [],
        lenses: view.clipConfig.lenses.map((lens) =>
          lens.exclusions?.length ? { ...lens, exclusions: [] } : lens,
        ),
      },
    };
  });
}

/**
 * Customiser config: SVG clipPath tint on photo plates when ready, else SVG lens-only demo.
 * Applies the lens-render hierarchy so preset edits propagate without per-frame duplication.
 */
export function buildCustomiserCompositorConfig(selection: CustomiserSelection): SunglassesCompositorConfig {
  let views = selection.frameSku.renderViews ?? [];

  if (selection.renderSettingsOverride) {
    views = stampRenderOverride(views, selection.renderSettingsOverride);
  } else if (
    selection.lensRenderPresets?.length ||
    selection.lensRenderSystemDefaults
  ) {
    views = applyLensRenderHierarchyToFrameViews(
      {
        id: selection.frameSku.id,
        name: selection.frameSku.name,
        price: selection.frameSku.price ?? 0,
        description: "",
        lensRenderPresetId: selection.frameSku.lensRenderPresetId,
        useLensRenderPreset: selection.frameSku.useLensRenderPreset,
        renderViews: views,
      },
      selection.lensRenderPresets,
      selection.lensRenderSystemDefaults,
    );
  }

  if (selection.previewGlassOccludersEnabled === false) {
    views = stripGlassOccluders(views);
  }

  const clipViews = buildClipViewsMap(views);
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
