import { describe, expect, it } from "vitest";

import {
  createLensClipConfig,
  normalizeLensClipConfig,
  resolveFrameExclusionShapes,
  resolveLensExclusionShapes,
} from "@bino-foundry/shared/types";

import {
  DEFAULT_LENS_CLIP_RENDER,
  resolveLensClipRenderSettings,
} from "./clip-settings";
import { lensClipConfigToMaskConfig } from "./clip-to-mask";
import { maskConfigToLensClipConfig } from "./mask-to-clip";
import { createLensPolygon, createMaskConfig } from "@/render/mask/mask-types";

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

describe("lens exclusion shapes", () => {
  it("returns only shapes with usable pathD", () => {
    const shapes = resolveLensExclusionShapes({
      exclusions: [
        { id: "a", label: "Bridge", pathD: "M0 0 L20 0 L20 10 Z" },
        { id: "b", label: "Empty", pathD: "" },
      ],
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.id).toBe("a");
  });

  it("migrates legacy frameExclusions onto per-lens exclusions", () => {
    const clip = normalizeLensClipConfig(
      createLensClipConfig(100, 100, [
        { id: "left", label: "Left", pathD: "M0 0 L50 0 L50 50 Z" },
        { id: "right", label: "Right", pathD: "M50 0 L100 0 L100 50 Z" },
      ]),
    );
    const migrated = normalizeLensClipConfig({
      ...clip,
      frameExclusions: [
        { id: "bridge", label: "Bridge", pathD: "M20 0 L30 0 L30 10 Z", lensId: "left" },
      ],
    });

    expect(migrated.frameExclusions).toBeUndefined();
    expect(resolveLensExclusionShapes(migrated.lenses[0])).toHaveLength(1);
    expect(resolveLensExclusionShapes(migrated.lenses[0])![0]!.id).toBe("bridge");
    expect(resolveFrameExclusionShapes(migrated)).toEqual([]);
  });

  it("round-trips exclusions through mask and clip config", () => {
    const leftLens = createLensPolygon("left", "Left lens", [
      { x: 0.1, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.4, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.25, y: 0.45, curved: false, handleIn: null, handleOut: null },
    ]);
    const rightLens = createLensPolygon("right", "Right lens", [
      { x: 0.6, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.9, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.75, y: 0.45, curved: false, handleIn: null, handleOut: null },
    ]);
    const exclusion = createLensPolygon("excl-1", "Bridge", [
      { x: 0.2, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.3, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.25, y: 0.3, curved: false, handleIn: null, handleOut: null },
    ]);
    const mask = createMaskConfig(200, 100, [leftLens, rightLens], {
      left: [exclusion],
    });

    const clip = maskConfigToLensClipConfig(mask);
    const left = clip.lenses.find((l) => l.id === "left");
    expect(left?.exclusions).toHaveLength(1);
    expect(left?.exclusions?.[0]?.pathD.length).toBeGreaterThan(8);

    const restored = lensClipConfigToMaskConfig(clip);
    expect(restored?.exclusions?.left).toHaveLength(1);
    expect(restored?.exclusions?.left?.[0]?.id).toBe("excl-1");
  });

  it("returns empty when missing", () => {
    expect(resolveLensExclusionShapes(null)).toEqual([]);
    expect(DEFAULT_LENS_CLIP_RENDER.mode).toBe("replace");
  });
});
