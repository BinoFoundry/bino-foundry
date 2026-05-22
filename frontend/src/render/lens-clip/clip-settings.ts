import type { LensClipConfig, LensClipRenderSettings } from "@bino-foundry/shared/types";

export const DEFAULT_LENS_CLIP_RENDER: Required<LensClipRenderSettings> = {
  lensOpacity: 0.88,
  tintBlendMode: "multiply",
  highlightStrength: 0.32,
  highlightBlendMode: "screen",
  shadowStrength: 0.08,
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
