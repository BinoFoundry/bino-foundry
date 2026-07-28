import { describe, expect, it } from "vitest";

import {
  compoundOccluderPathD,
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

describe("compoundOccluderPathD", () => {
  it("returns the outer path alone when there are no holes", () => {
    expect(compoundOccluderPathD({ pathD: "M 0 0 L 1 0 L 1 1 Z" })).toBe("M 0 0 L 1 0 L 1 1 Z");
  });

  it("concatenates outer and hole subpaths for even-odd fills", () => {
    const d = compoundOccluderPathD({
      pathD: "M 0 0 L 10 0 L 10 10 Z",
      holePathDs: ["M 2 2 L 8 2 L 8 8 Z"],
    });
    expect(d).toBe("M 0 0 L 10 0 L 10 10 Z M 2 2 L 8 2 L 8 8 Z");
  });
});

describe("resolveLensClipRenderSettings", () => {
  it("defaults Automatic Inner Frame on with sensible thickness", () => {
    const resolved = resolveLensClipRenderSettings(null);
    expect(resolved.innerFrameEnabled).toBe(true);
    expect(resolved.innerFrameThickness).toBe(2);
    expect(resolved.innerFrameOpacity).toBe(70);
    expect(resolved.innerFrameFeather).toBe(25);
    expect(resolved.innerFrameBlendMode).toBe("normal");
  });

  it("clamps Automatic Inner Frame controls", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        innerFrameEnabled: false,
        innerFrameThickness: 99,
        innerFrameOpacity: 150,
        innerFrameFeather: -5,
        innerFrameBlendMode: "multiply",
      },
    });
    expect(resolved.innerFrameEnabled).toBe(false);
    expect(resolved.innerFrameThickness).toBe(8);
    expect(resolved.innerFrameOpacity).toBe(100);
    expect(resolved.innerFrameFeather).toBe(0);
    expect(resolved.innerFrameBlendMode).toBe("multiply");
  });

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
    expect(resolved.automaticMaterialBehavior).toBe(true);
    expect(resolved.originalLensColorInfluence).toBe(15);
    expect(resolved.materialInfluence).toBeGreaterThan(30);
    expect(resolved.baseBrightness).toBe(0);
    expect(resolved.baseGamma).toBe(1);
    expect(resolved.glassAbsorption).toBeGreaterThan(14);
    expect(resolved.glassDiffusion).toBeGreaterThan(12);
    expect(resolved.glassDepth).toBeGreaterThan(32);
  });

  it("resolves and clamps manual calibration controls", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        automaticMaterialBehavior: false,
        originalLensColorInfluence: 150,
        materialInfluence: 150,
        baseBrightness: -150,
        baseGamma: 3,
        glassAbsorption: -10,
        glassDiffusion: 140,
        glassDepth: 75,
      },
    });
    expect(resolved.materialInfluence).toBe(100);
    expect(resolved.originalLensColorInfluence).toBe(100);
    expect(resolved.baseGlassNeutralization).toBe(0);
    expect(resolved.baseBrightness).toBe(-100);
    expect(resolved.baseGamma).toBe(2.5);
    expect(resolved.glassAbsorption).toBe(0);
    expect(resolved.glassDiffusion).toBe(100);
    expect(resolved.glassDepth).toBe(75);
  });

  it("prefers Base Glass Neutralization and promotes legacy density aliases", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        automaticMaterialBehavior: false,
        baseGlassNeutralization: 40,
        glassBaseDensity: 66,
        baseDensityBias: 77,
      },
    });
    expect(resolved.baseGlassNeutralization).toBe(40);
    expect(resolved.originalLensColorInfluence).toBe(60);
    expect(resolved.baseGlassDarkness).toBe(66);
    expect(resolved.baseGlassRichness).toBe(77);
  });

  it("maps legacy glassMaterialStrength onto materialInfluence when missing", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        automaticMaterialBehavior: false,
        glassMaterialStrength: 65,
      },
    });
    expect(resolved.materialInfluence).toBe(65);
  });

  it("uses every optical layer value exactly in manual mode", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [],
      render: {
        automaticMaterialBehavior: false,
        reflectionEnabled: false,
        reflectionOpacity: 0.31,
        reflectionStrength: 0.47,
        reflectionBlur: 0.73,
        reflectionPosition: 24,
        reflectionOffsetX: 18,
        reflectionOffsetY: -22,
        reflectionScale: 1.36,
        reflectionAngle: 315,
        internalReflectionEnabled: true,
        internalReflectionOpacity: 0.06,
        internalReflectionSoftness: 0.81,
        internalReflectionScale: 1.14,
        internalReflectionAngle: 326,
        fresnelEnabled: true,
        fresnelStrength: 0.17,
        fresnelWidth: 0.23,
        fresnelSoftness: 0.64,
        edgeDensity: 0.29,
        edgeSoftness: 0.61,
        edgeOpacity: 0.33,
        lensTransmission: 0.48,
      },
    });
    expect(resolved.reflectionEnabled).toBe(false);
    expect(resolved.reflectionOpacity).toBe(0.31);
    expect(resolved.reflectionStrength).toBe(0.47);
    expect(resolved.reflectionBlur).toBe(0.73);
    expect(resolved.reflectionPosition).toBe(24);
    expect(resolved.reflectionOffsetX).toBe(18);
    expect(resolved.reflectionOffsetY).toBe(-22);
    expect(resolved.reflectionScale).toBe(1.36);
    expect(resolved.reflectionAngle).toBe(315);
    expect(resolved.internalReflectionEnabled).toBe(true);
    expect(resolved.internalReflectionOpacity).toBe(0.06);
    expect(resolved.internalReflectionSoftness).toBe(0.81);
    expect(resolved.internalReflectionScale).toBe(1.14);
    expect(resolved.internalReflectionAngle).toBe(326);
    expect(resolved.fresnelEnabled).toBe(true);
    expect(resolved.fresnelStrength).toBe(0.17);
    expect(resolved.fresnelWidth).toBe(0.23);
    expect(resolved.fresnelSoftness).toBe(0.64);
    expect(resolved.edgeDensity).toBe(0.29);
    expect(resolved.edgeSoftness).toBe(0.61);
    expect(resolved.edgeOpacity).toBe(0.33);
    expect(resolved.lensTransmission).toBe(0.48);
  });

  it("clamps and honours a base tint opacity override", () => {
    const resolved = resolveLensClipRenderSettings(
      {
        version: 1,
        imageWidth: 10,
        imageHeight: 10,
        lenses: [],
        render: { automaticMaterialBehavior: false, baseTintOpacity: 0.7 },
      },
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
        automaticMaterialBehavior: false,
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
      render: { automaticMaterialBehavior: false, lensOpacity: 0.55 },
    });
    expect(resolved.lensOpacity).toBe(0.55);
    expect(resolved.tintOpacity).toBe(DEFAULT_LENS_CLIP_RENDER.tintOpacity);
  });

  it("applies tint layer opacity directly and honours overrides", () => {
    expect(resolveLensClipRenderSettings(null).tintLayerOpacity).toBe(0.42978);
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { tintLayerOpacity: 0.4 },
    });
    expect(resolved.tintLayerOpacity).toBe(0.4);
    // Perceived-thickness control must not alter the selected tint strength.
    expect(resolved.tintOpacity).toBe(DEFAULT_LENS_CLIP_RENDER.tintOpacity);
  });

  it("migrates the legacy tint filter multiplier onto the direct layer opacity", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: { tintFilterOpacity: 0.5 },
    });
    expect(resolved.tintLayerOpacity).toBeCloseTo(0.21489);
  });

  it("keeps glass transmission independent from surface opacity", () => {
    const resolved = resolveLensClipRenderSettings({
      version: 1,
      imageWidth: 10,
      imageHeight: 10,
      lenses: [{ id: "l", label: "L", pathD: "M0 0 L10 0 L10 10 Z" }],
      render: {
        automaticMaterialBehavior: false,
        lensOpacity: 0.92,
        lensTransmission: 0.58,
      },
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
      render: {
        automaticMaterialBehavior: false,
        lensOpacity: 0.35,
        frameExclusionOpacity: 0.9,
      },
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
    expect(normalized.frameExclusions![0]!.layerOrder).toBe("behind");
    expect(normalized.frameExclusions![0]!.opacity).toBe(100);
    expect(normalized.frameExclusions![0]!.visible).toBe(true);
    expect(resolveFrameExclusionShapes(normalized)).toHaveLength(1);
  });

  it("preserves layer order and opacity on frame objects", () => {
    const normalized = normalizeLensClipConfig({
      version: 1,
      imageWidth: 100,
      imageHeight: 100,
      lenses: [{ id: "left", label: "Left", pathD: "M0 0 L50 0 L50 50 Z" }],
      frameExclusions: [
        {
          id: "screw",
          label: "Screw",
          pathD: "M10 10 L20 10 L20 20 Z",
          layerOrder: "front",
          opacity: 70,
          depth: 80,
        },
      ],
    });
    expect(normalized.frameExclusions?.[0]?.layerOrder).toBe("front");
    expect(normalized.frameExclusions?.[0]?.opacity).toBe(70);
    expect(normalized.frameExclusions?.[0]?.depth).toBe(80);
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

  it("round-trips compound occluders with hole polygons", () => {
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
    const ring = createLensPolygon(
      "ring-1",
      "Inner Lip",
      [
        { x: 0.1, y: 0.1, curved: false, handleIn: null, handleOut: null },
        { x: 0.4, y: 0.1, curved: false, handleIn: null, handleOut: null },
        { x: 0.4, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.1, y: 0.4, curved: false, handleIn: null, handleOut: null },
      ],
      {
        holes: [
          {
            id: "ring-1-hole-1",
            label: "Hole 1",
            points: [
              { x: 0.18, y: 0.18, curved: false, handleIn: null, handleOut: null },
              { x: 0.32, y: 0.18, curved: false, handleIn: null, handleOut: null },
              { x: 0.32, y: 0.32, curved: false, handleIn: null, handleOut: null },
              { x: 0.18, y: 0.32, curved: false, handleIn: null, handleOut: null },
            ],
          },
        ],
      },
    );
    const mask = createMaskConfig(200, 100, [leftLens, rightLens], undefined, [ring]);
    const clip = maskConfigToLensClipConfig(mask);
    expect(clip.frameExclusions?.[0]?.holePathDs).toHaveLength(1);
    expect(clip.frameExclusions?.[0]?.holePathDs?.[0]?.length).toBeGreaterThan(8);

    const restored = lensClipConfigToMaskConfig(clip);
    expect(restored?.frameExclusions?.[0]?.holes).toHaveLength(1);
    expect(restored?.frameExclusions?.[0]?.holes?.[0]?.points.length).toBeGreaterThanOrEqual(3);
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
