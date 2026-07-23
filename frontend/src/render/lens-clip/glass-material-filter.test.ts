import { describe, expect, it } from "vitest";

import {
  approximatePathBounds,
  resolveBaseGlassDarknessAmount,
  resolveBaseGlassRichnessAmount,
  resolveGlassMaterialFilterParams,
  resolveLensReflectionSide,
  resolveReflectionAppearanceForSide,
  resolveReflectionTransformForSide,
  resolveSourceChromaRetain,
} from "./glass-material-filter";
import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";
import type { LensClipShape } from "@bino-foundry/shared/types";

const leftLens: LensClipShape = {
  id: "left",
  label: "Left",
  pathD: "M10 20 L90 20 L90 100 L10 100 Z",
};
const rightLens: LensClipShape = {
  id: "right",
  label: "Right",
  pathD: "M210 20 L290 20 L290 100 L210 100 Z",
};

describe("resolveGlassMaterialFilterParams", () => {
  it("enables reflection module only when reflection is on", () => {
    const off = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        reflectionEnabled: false,
        tintLayerOpacity: 0.6,
      },
      200,
      120,
    );
    const on = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        reflectionEnabled: true,
        reflectionOpacity: 0.3,
        reflectionStrength: 0.5,
        tintLayerOpacity: 0.6,
      },
      200,
      120,
    );
    expect(off.reflection.enabled).toBe(false);
    expect(on.reflection.enabled).toBe(true);
    expect(on.reflection.opacity).toBeCloseTo(0.15);
  });

  it("maps absorption and density into filter gains", () => {
    const light = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassAbsorption: 10,
        glassDepth: 20,
        centerDensity: 0,
        tintLayerOpacity: 1,
        lensOpacity: 1,
        environmentTransparency: 0,
        backgroundVisibility: 0,
        baseGlassDarkness: 0,
        baseGlassRichness: 0,
      },
      100,
      100,
    );
    const heavy = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassAbsorption: 80,
        glassDepth: 90,
        centerDensity: 0.3,
        tintLayerOpacity: 1,
        lensOpacity: 1,
        environmentTransparency: 0,
        backgroundVisibility: 0,
        baseGlassDarkness: 0,
        baseGlassRichness: 0,
      },
      100,
      100,
    );
    expect(heavy.absorptionGain).toBeGreaterThan(light.absorptionGain);
    expect(heavy.edgeDensity).toBeGreaterThanOrEqual(0);
  });

  it("places reflection lights relative to each lens polygon", () => {
    const left = resolveGlassMaterialFilterParams(
      DEFAULT_LENS_CLIP_RENDER,
      400,
      200,
      leftLens,
      [leftLens, rightLens],
    );
    const right = resolveGlassMaterialFilterParams(
      DEFAULT_LENS_CLIP_RENDER,
      400,
      200,
      rightLens,
      [leftLens, rightLens],
    );
    expect(left.reflection.lightX).toBeLessThan(right.reflection.lightX);
    expect(Math.abs(left.reflection.lightX - approximatePathBounds(leftLens.pathD).cx)).toBeLessThan(
      40,
    );
    expect(Math.abs(right.reflection.lightX - approximatePathBounds(rightLens.pathD).cx)).toBeLessThan(
      40,
    );
  });

  it("mirrors right reflection from left when mirrorReflection is enabled", () => {
    const mirrored = resolveReflectionTransformForSide(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        mirrorReflection: true,
        reflectionOffsetX: -18,
        reflectionOffsetY: -6,
        reflectionScale: 1.2,
        reflectionAngle: 30,
      },
      "right",
    );
    expect(mirrored.offsetX).toBe(18);
    expect(mirrored.offsetY).toBe(-6);
    expect(mirrored.scale).toBe(1.2);
    expect(mirrored.angle).toBe(330);
  });

  it("uses independent right controls when mirroring is off", () => {
    const independent = resolveReflectionTransformForSide(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        mirrorReflection: false,
        reflectionRightOffsetX: 22,
        reflectionRightOffsetY: -4,
        reflectionRightScale: 1.4,
        reflectionRightAngle: 40,
      },
      "right",
    );
    expect(independent.offsetX).toBe(22);
    expect(independent.offsetY).toBe(-4);
    expect(independent.scale).toBe(1.4);
    expect(independent.angle).toBe(40);
  });

  it("uses independent right opacity and softness when mirroring is off", () => {
    const right = resolveReflectionAppearanceForSide(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        mirrorReflection: false,
        reflectionOpacity: 0.4,
        reflectionBlur: 0.2,
        reflectionStrength: 0.5,
        reflectionRightOpacity: 0.1,
        reflectionRightBlur: 0.9,
      },
      "right",
    );
    expect(right.opacity).toBeCloseTo(0.05);
    expect(right.softBlur).toBe(0.9);
  });

  it("classifies lenses by label or horizontal centre", () => {
    expect(resolveLensReflectionSide(leftLens, [leftLens, rightLens])).toBe("left");
    expect(resolveLensReflectionSide(rightLens, [leftLens, rightLens])).toBe("right");
  });

  it("increases optical darkness without changing tint opacity semantics", () => {
    const clear = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        baseGlassDarkness: 0,
        baseGlassRichness: 0,
        tintLayerOpacity: 0.5,
        lensTransmission: 0.7,
      },
      100,
      100,
    );
    const dark = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        baseGlassDarkness: 90,
        baseGlassRichness: 0,
        tintLayerOpacity: 0.5,
        lensTransmission: 0.7,
      },
      100,
      100,
    );
    expect(dark.foundationTransmission).toBeLessThan(clear.foundationTransmission);
    expect(dark.absorptionGain).toBeGreaterThan(clear.absorptionGain);
    expect(dark.baseDensityDarken).toBeGreaterThan(clear.baseDensityDarken);
    expect(dark.bodyOpacity).toBeGreaterThan(0);
  });

  it("increases richness as depth without treating it as tint multiply", () => {
    const flat = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        baseGlassDarkness: 20,
        baseGlassRichness: 0,
      },
      100,
      100,
    );
    const rich = resolveGlassMaterialFilterParams(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        baseGlassDarkness: 20,
        baseGlassRichness: 90,
      },
      100,
      100,
    );
    expect(rich.richnessDepth).toBeGreaterThan(flat.richnessDepth);
    expect(rich.centerDensity).toBeGreaterThan(flat.centerDensity);
    expect(rich.diffusionBlurPx).toBeGreaterThan(flat.diffusionBlurPx);
  });

  it("maps neutralization to retained source chroma", () => {
    expect(resolveSourceChromaRetain(0)).toBe(1);
    expect(resolveSourceChromaRetain(100)).toBe(0);
    expect(resolveSourceChromaRetain(85)).toBeCloseTo(0.15);
    expect(resolveBaseGlassDarknessAmount(50)).toBeCloseTo(0.5);
    expect(resolveBaseGlassRichnessAmount(40)).toBeCloseTo(0.4);
  });
});
