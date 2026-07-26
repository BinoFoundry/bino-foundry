import { describe, expect, it } from "vitest";
import type { LensClipShape } from "@bino-foundry/shared/types";

import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";
import {
  buildDensityGradientStops,
  resolvePrototypeGlassAppearance,
} from "./prototype-glass-appearance";

const lens: LensClipShape = {
  id: "left",
  label: "Left",
  pathD: "M10 20 L90 20 L90 100 L10 100 Z",
};

describe("resolvePrototypeGlassAppearance", () => {
  it("builds a present glass element from default settings", () => {
    const appearance = resolvePrototypeGlassAppearance(
      DEFAULT_LENS_CLIP_RENDER,
      "#8F1830",
      lens,
      [lens],
    );
    expect(appearance.glassPresent).toBe(true);
    expect(appearance.tint.enabled).toBe(true);
    expect(appearance.tint.blend).toBe("kaca");
    expect(appearance.tint.colorOpacity).toBeGreaterThan(0);
    expect(appearance.tint.solidOpacity).toBeGreaterThan(0);
    expect(appearance.tint.softLightOpacity).toBeGreaterThan(0);
    expect(appearance.dark.enabled).toBe(true);
  });

  it("increases dark body with dark layer opacity", () => {
    const clear = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        darkLayerOpacity: 0,
        darkLayerEnabled: true,
      },
      "#8F1830",
      lens,
      [lens],
    );
    const dark = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        darkLayerOpacity: 90,
        darkLayerEnabled: true,
      },
      "#8F1830",
      lens,
      [lens],
    );
    expect(dark.dark.opacity).toBeGreaterThan(clear.dark.opacity);
  });

  it("disables specular when reflection is off", () => {
    const off = resolvePrototypeGlassAppearance(
      { ...DEFAULT_LENS_CLIP_RENDER, reflectionEnabled: false },
      "#8F1830",
      lens,
      [lens],
    );
    expect(off.specular.enabled).toBe(false);
  });

  it("marks glass absent when all material layers are off", () => {
    const identity = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassTintEnabled: false,
        tintLayerOpacity: 0,
        darkLayerEnabled: false,
        darkLayerOpacity: 0,
        edgeEnabled: false,
        edgeDensity: 0,
        edgeOpacity: 0,
        reflectionEnabled: false,
        glassTintShine: 0,
        backgroundVisibility: 0,
        environmentTransparency: 0,
        lensOpacity: 0,
        glassDepth: 0,
      },
      "#8F1830",
      lens,
      [lens],
    );
    expect(identity.glassPresent).toBe(false);
  });

  it("honours non-kaca tint blend modes", () => {
    const multiply = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        glassTintBlend: "multiply",
        tintLayerOpacity: 0.8,
      },
      "#8F1830",
      lens,
      [lens],
    );
    expect(multiply.tint.blend).toBe("multiply");
    expect(multiply.tint.solidOpacity).toBe(0);
    expect(multiply.tint.softLightOpacity).toBe(0);
    expect(multiply.tint.colorOpacity).toBeCloseTo(0.8);
  });

  it("keeps density gradient disabled (retired with Glass Sheet)", () => {
    const off = resolvePrototypeGlassAppearance(DEFAULT_LENS_CLIP_RENDER, "#8F1830", lens, [
      lens,
    ]);
    expect(off.densityGradient.enabled).toBe(false);

    const forced = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        densityGradientEnabled: true,
        densityGradientMode: "vertical",
        densityGradientStartFalloff: 10,
        densityGradientEndFalloff: 80,
        densityGradientPosition: 40,
        densityGradientCurve: "ease-in-out",
        densityGradientTwoColor: true,
      },
      "#8F1830",
      lens,
      [lens],
    );
    expect(forced.densityGradient.enabled).toBe(false);
  });

  it("ignores density gradient colour settings when retired", () => {
    const appearance = resolvePrototypeGlassAppearance(
      {
        ...DEFAULT_LENS_CLIP_RENDER,
        densityGradientEnabled: true,
        densityGradientMode: "horizontal",
        densityGradientTwoColor: true,
        densityGradientStartColor: "#1E1E1E",
        densityGradientEndColor: "#4B4B4B",
        densityGradientStartFalloff: 50,
        densityGradientEndFalloff: 50,
      },
      "#8F1830",
      lens,
      [lens],
    );
    expect(appearance.densityGradient.enabled).toBe(false);
    expect(appearance.densityGradient.stops).toHaveLength(0);
  });

  it("keeps start dense longer when start falloff is high", () => {
    const quickStart = buildDensityGradientStops({
      startFalloff: 10,
      endFalloff: 50,
      position: 50,
      curve: "linear",
      startColor: "#111111",
      endColor: "#EEEEEE",
      twoColor: true,
    });
    const slowStart = buildDensityGradientStops({
      startFalloff: 80,
      endFalloff: 50,
      position: 50,
      curve: "linear",
      startColor: "#111111",
      endColor: "#EEEEEE",
      twoColor: true,
    });
    // At 18% along the axis, high start falloff should still be closer to the start colour.
    const q = quickStart.find((s) => s.offset === 0.18)!;
    const s = slowStart.find((s) => s.offset === 0.18)!;
    const qMix = Number.parseInt(q.color.match(/rgb\((\d+)/)?.[1] ?? "0", 10);
    const sMix = Number.parseInt(s.color.match(/rgb\((\d+)/)?.[1] ?? "0", 10);
    expect(sMix).toBeLessThan(qMix);
  });
});
