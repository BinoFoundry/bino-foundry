import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";

export const DEFAULT_LENS_CLIP_RENDER: Required<LensClipRenderSettings> = {
  lensOpacity: 0.58,
  tintBlendMode: "soft-light",
  highlightStrength: 0.38,
  highlightBlendMode: "screen",
  shadowStrength: 0.06,
};

export function resolveLensClipRenderSettings(
  clipConfig: LensClipConfig | null | undefined,
  overrides?: LensClipRenderSettings,
): Required<LensClipRenderSettings> {
  const fromConfig = (clipConfig as LensClipConfig & { render?: LensClipRenderSettings })?.render;
  return {
    ...DEFAULT_LENS_CLIP_RENDER,
    ...fromConfig,
    ...overrides,
  };
}
