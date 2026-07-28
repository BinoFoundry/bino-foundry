import { describe, expect, it } from "vitest";

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

  it("can isolate tint-only for calibration without touching the draft", () => {
    const draft = {
      ...DEFAULT_LENS_CLIP_RENDER,
      glassSheetUrl: "https://cdn.example/sheet.png",
      glassTintEnabled: true,
      reflectionEnabled: true,
      edgeEnabled: true,
    };
    const tintOnly = applyPreviewRenderMode(draft, {
      glassSheet: true,
      tintLayer: true,
      reflection: false,
      edge: false,
      innerFrame: false,
      manualDetails: false,
    });
    expect(tintOnly.glassTintEnabled).toBe(true);
    expect(tintOnly.reflectionEnabled).toBe(false);
    expect(tintOnly.edgeEnabled).toBe(false);
    expect(tintOnly.innerFrameEnabled).toBe(false);
    expect(tintOnly.glassSheetUrl).toBe("https://cdn.example/sheet.png");
    expect(draft.reflectionEnabled).toBe(true);
  });

  it("temporarily clears the glass sheet URL when the sheet toggle is off", () => {
    const draft = {
      ...DEFAULT_LENS_CLIP_RENDER,
      glassSheetUrl: "https://cdn.example/sheet.png",
    };
    const next = applyPreviewRenderMode(draft, {
      ...DEFAULT_PREVIEW_RENDER_MODE,
      glassSheet: false,
    });
    expect(next.glassSheetUrl).toBeNull();
    expect(draft.glassSheetUrl).toBe("https://cdn.example/sheet.png");
  });

  it("gates the automatic Inner Frame via preview toggle", () => {
    const draft = {
      ...DEFAULT_LENS_CLIP_RENDER,
      innerFrameEnabled: true,
    };
    const next = applyPreviewRenderMode(draft, {
      ...DEFAULT_PREVIEW_RENDER_MODE,
      innerFrame: false,
    });
    expect(next.innerFrameEnabled).toBe(false);
    expect(draft.innerFrameEnabled).toBe(true);
  });

  it("never re-enables retired density or background controls", () => {
    const next = applyPreviewRenderMode(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        densityGradientEnabled: true,
        backgroundVisibility: 0.5,
        environmentTransparency: 0.4,
      },
      DEFAULT_PREVIEW_RENDER_MODE,
    );
    expect(next.densityGradientEnabled).toBe(false);
    expect(next.backgroundVisibility).toBe(0);
    expect(next.environmentTransparency).toBe(0);
  });
});
