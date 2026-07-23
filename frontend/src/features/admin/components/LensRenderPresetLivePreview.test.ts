import { describe, expect, it } from "vitest";
import { LENS_RENDER_ZERO_SETTINGS } from "@bino-foundry/shared/types";

import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";
import {
  DEFAULT_PREVIEW_RENDER_MODE,
  applyPreviewRenderMode,
} from "./LensRenderPresetLivePreview";

describe("applyPreviewRenderMode", () => {
  it("does not mutate the draft preset object", () => {
    const draft = { ...DEFAULT_LENS_CLIP_RENDER, glassTintEnabled: true };
    const next = applyPreviewRenderMode(draft, {
      ...DEFAULT_PREVIEW_RENDER_MODE,
      tintLayer: false,
    });
    expect(draft.glassTintEnabled).toBe(true);
    expect(next.glassTintEnabled).toBe(false);
  });

  it("shows original lens only when material layers are off", () => {
    const next = applyPreviewRenderMode(DEFAULT_LENS_CLIP_RENDER, {
      ...DEFAULT_PREVIEW_RENDER_MODE,
      useMaterialLayers: false,
    });
    expect(next.glassTintEnabled).toBe(LENS_RENDER_ZERO_SETTINGS.glassTintEnabled);
    expect(next.darkLayerEnabled).toBe(LENS_RENDER_ZERO_SETTINGS.darkLayerEnabled);
    expect(next.reflectionEnabled).toBe(LENS_RENDER_ZERO_SETTINGS.reflectionEnabled);
    expect(next.tintLayerOpacity).toBe(0);
  });

  it("can isolate tint-only vs reflection-off for calibration", () => {
    const tintOnly = applyPreviewRenderMode(DEFAULT_LENS_CLIP_RENDER, {
      useMaterialLayers: true,
      tintLayer: true,
      reflection: false,
      internalGlass: false,
      edge: false,
      backgroundVisibility: false,
    });
    expect(tintOnly.glassTintEnabled).toBe(true);
    expect(tintOnly.reflectionEnabled).toBe(false);
    expect(tintOnly.darkLayerEnabled).toBe(false);
    expect(tintOnly.edgeEnabled).toBe(false);
    expect(tintOnly.backgroundVisibility).toBe(0);
  });
});
