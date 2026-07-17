import { describe, expect, it } from "vitest";

import { createLensClipConfig, resolveFrameExclusionShapes } from "@bino-foundry/shared/types";

import {
  DEFAULT_LENS_CLIP_RENDER,
  resolveLensClipRenderSettings,
} from "./clip-settings";

describe("resolveLensClipRenderSettings", () => {
  it("defaults to replace mode with optical layers enabled", () => {
    const resolved = resolveLensClipRenderSettings(null);
    expect(resolved.mode).toBe("replace");
    expect(resolved.reflectionEnabled).toBe(true);
    expect(resolved.glossEnabled).toBe(true);
    expect(resolved.vignetteEnabled).toBe(true);
    expect(resolved.polarizedEnabled).toBe(false);
  });

  it("honours frame render overrides and tint opacity override", () => {
    const clip = createLensClipConfig(
      100,
      100,
      [{ id: "left", label: "Left", pathD: "M0 0 L10 0 L10 10 Z" }],
      {
        mode: "replace",
        tintOpacity: 0.4,
        reflectionEnabled: false,
        polarizedEnabled: true,
        polarizedStrength: 0.3,
      },
    );
    const resolved = resolveLensClipRenderSettings(clip, { tintOpacity: 0.9 });
    expect(resolved.tintOpacity).toBe(0.9);
    expect(resolved.reflectionEnabled).toBe(false);
    expect(resolved.polarizedEnabled).toBe(true);
    expect(resolved.polarizedStrength).toBe(0.3);
  });

  it("falls back lensOpacity to tintOpacity", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { lensOpacity: 0.55 },
    });
    expect(resolved.tintOpacity).toBe(0.55);
  });
});

describe("resolveFrameExclusionShapes", () => {
  it("returns only shapes with usable pathD", () => {
    const shapes = resolveFrameExclusionShapes({
      frameExclusions: [
        { id: "a", label: "Bridge", pathD: "M0 0 L20 0 L20 10 Z" },
        { id: "b", label: "Empty", pathD: "" },
      ],
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.id).toBe("a");
  });

  it("returns empty when missing", () => {
    expect(resolveFrameExclusionShapes(null)).toEqual([]);
    expect(DEFAULT_LENS_CLIP_RENDER.mode).toBe("replace");
  });
});
