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
    expect(resolved.transparency).toBeGreaterThan(0);
    expect(resolved.transparency).toBeLessThan(1);
    expect(resolved.lensOpacity).toBeCloseTo(1 - resolved.transparency);
    expect(resolved.frameExclusionOpacity).toBe(1);
  });

  it("clamps and honours a base tint opacity override", () => {
    const resolved = resolveLensClipRenderSettings(
      { version: 1, imageWidth: 10, imageHeight: 10, lenses: [], render: { baseTintOpacity: 0.7 } },
    );
    expect(resolved.baseTintOpacity).toBe(0.7);
    expect(resolved.transparency).toBeCloseTo(0.3);
  });

  it("resolves database-driven glass appearance controls", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        transparency: 0.6,
        lensTransmission: 0.48,
        brightness: 1.2,
        contrast: 1.1,
        saturation: 0.8,
        gradientStrength: 0.5,
        reflectionStrength: 0.7,
        reflectionAngle: 405,
        glossStrength: 0.4,
        edgeFade: 0.2,
        edgeDarkness: 0.3,
        edgeWidth: 0.008,
      },
    });

    expect(resolved.baseTintOpacity).toBeCloseTo(0.4);
    expect(resolved.lensTransmission).toBe(0.48);
    expect(resolved.brightness).toBe(1.2);
    expect(resolved.contrast).toBe(1.1);
    expect(resolved.saturation).toBe(0.8);
    expect(resolved.gradientStrength).toBe(0.5);
    expect(resolved.reflectionStrength).toBe(0.7);
    expect(resolved.reflectionAngle).toBe(45);
    expect(resolved.glossStrength).toBe(0.4);
    expect(resolved.edgeFade).toBe(0.2);
    expect(resolved.edgeDarkness).toBe(0.3);
    expect(resolved.edgeWidth).toBe(0.008);
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

  it("keeps lens and tint opacity independent", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { lensOpacity: 0.55 },
    });
    expect(resolved.lensOpacity).toBe(0.55);
    expect(resolved.tintOpacity).toBe(DEFAULT_LENS_CLIP_RENDER.tintOpacity);
  });

  it("keeps glass transmission independent from surface opacity", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { lensOpacity: 0.92, lensTransmission: 0.58 },
    });
    expect(resolved.lensOpacity).toBe(0.92);
    expect(resolved.lensTransmission).toBe(0.58);
  });

  it("keeps frame exclusion opacity independent from lens opacity", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { lensOpacity: 0.35, frameExclusionOpacity: 0.9 },
    });
    expect(resolved.lensOpacity).toBe(0.35);
    expect(resolved.frameExclusionOpacity).toBe(0.9);
  });
});

describe("frame exclusion shapes", () => {
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

  it("keeps root frameExclusions as the canonical frame-level list", () => {
    const clip = normalizeLensClipConfig(
      createLensClipConfig(100, 100, [
        { id: "left", label: "Left", pathD: "M0 0 L50 0 L50 50 Z" },
        { id: "right", label: "Right", pathD: "M50 0 L100 0 L100 50 Z" },
      ]),
    );
    const normalized = normalizeLensClipConfig({
      ...clip,
      frameExclusions: [
        { id: "bridge", label: "Bridge", pathD: "M20 0 L30 0 L30 10 Z", lensId: "left" },
      ],
    });

    expect(normalized.lenses[0]!.exclusions).toBeUndefined();
    expect(normalized.frameExclusions).toHaveLength(1);
    expect(normalized.frameExclusions![0]!.id).toBe("bridge");
    expect(resolveFrameExclusionShapes(normalized)).toHaveLength(1);
  });

  it("migrates legacy per-lens exclusions up to frame-level frameExclusions", () => {
    const migrated = normalizeLensClipConfig(
      createLensClipConfig(100, 100, [
        {
          id: "left",
          label: "Left",
          pathD: "M0 0 L50 0 L50 50 Z",
          exclusions: [{ id: "bridge", label: "Bridge", pathD: "M20 0 L30 0 L30 10 Z" }],
        },
        { id: "right", label: "Right", pathD: "M50 0 L100 0 L100 50 Z" },
      ]),
    );

    expect(migrated.lenses[0]!.exclusions).toBeUndefined();
    expect(migrated.frameExclusions).toHaveLength(1);
    expect(migrated.frameExclusions![0]!.id).toBe("bridge");
  });

  it("round-trips frame exclusions through mask and clip config", () => {
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
    const mask = createMaskConfig(200, 100, [leftLens, rightLens], undefined, [exclusion]);

    const clip = maskConfigToLensClipConfig(mask);
    expect(clip.frameExclusions).toHaveLength(1);
    expect(clip.frameExclusions?.[0]?.pathD.length).toBeGreaterThan(8);
    expect(clip.lenses.every((l) => l.exclusions === undefined)).toBe(true);

    const restored = lensClipConfigToMaskConfig(clip);
    expect(restored?.frameExclusions).toHaveLength(1);
    expect(restored?.frameExclusions?.[0]?.id).toBe("excl-1");
  });

  it("migrates a legacy by-side mask exclusion into frame-level clip exclusions", () => {
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
    const legacyExclusion = createLensPolygon("legacy-1", "Bridge", [
      { x: 0.2, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.3, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.25, y: 0.3, curved: false, handleIn: null, handleOut: null },
    ]);
    const legacyMask = createMaskConfig(200, 100, [leftLens, rightLens], {
      left: [legacyExclusion],
    });

    const clip = maskConfigToLensClipConfig(legacyMask);
    expect(clip.frameExclusions).toHaveLength(1);
    expect(clip.frameExclusions?.[0]?.id).toBe("legacy-1");
  });

  it("returns empty when missing", () => {
    expect(resolveLensExclusionShapes(null)).toEqual([]);
    expect(resolveFrameExclusionShapes(null)).toEqual([]);
    expect(DEFAULT_LENS_CLIP_RENDER.mode).toBe("replace");
  });
});
