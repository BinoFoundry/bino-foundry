import { describe, expect, it } from "vitest";

import {
  buildCssTintBackground,
  buildSvgGradientStops,
  cssGradientAngle,
  getLinearGradientVector,
  isClassicTint,
  lensTintEntryToRenderSpec,
  normalizeTintRenderSpec,
} from "./lens-tint-spec";

describe("lens-tint-spec", () => {
  it("maps catalog entry with render fields", () => {
    const spec = lensTintEntryToRenderSpec({
      id: "1",
      code: "OCEAN",
      name: "Ocean",
      category: "gradient",
      gradientTop: "#112233",
      gradientBottom: "#445566",
      opacity: 0.6,
      gradientDirection: "left-to-right",
      gradientAngle: 90,
      gradientMidPosition: 40,
      gradientIntensity: 0.7,
      priceSurcharge: 5,
      displayOrder: 0,
      isActive: true,
    });
    expect(spec.top).toBe("#112233");
    expect(spec.opacity).toBe(0.6);
    expect(spec.gradientDirection).toBe("left-to-right");
    expect(cssGradientAngle(spec)).toBe(90);
  });

  it("builds multi-stop gradient for gradient category", () => {
    const stops = buildSvgGradientStops(
      normalizeTintRenderSpec({
        name: "G",
        top: "#111111",
        bottom: "#222222",
        category: "gradient",
      }),
    );
    expect(stops.length).toBeGreaterThan(2);
  });

  it("uses solid stops for classic", () => {
    const stops = buildSvgGradientStops(
      normalizeTintRenderSpec({
        name: "C",
        top: "#abcdef",
        bottom: "#abcdef",
        category: "classic",
      }),
    );
    expect(stops).toHaveLength(2);
    expect(isClassicTint({ category: "classic", top: "#a", bottom: "#a" })).toBe(true);
  });

  it("supports custom direction vector", () => {
    const v = getLinearGradientVector({ gradientDirection: "custom", gradientAngle: 45 });
    expect(v.gradientTransform).toContain("rotate(45");
  });

  it("builds CSS gradient with direction", () => {
    const css = buildCssTintBackground(
      normalizeTintRenderSpec({
        name: "G",
        top: "#ff0000",
        bottom: "#0000ff",
        category: "gradient",
        gradientDirection: "bottom-to-top",
      }),
    );
    expect(css).toContain("linear-gradient");
    expect(css).toContain("#ff0000");
  });
});
