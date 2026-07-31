import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { SvgClipCompositorView } from "./SvgClipCompositorView";

vi.mock("@/render/image-bounds", () => ({
  usePlateContentBounds: () => ({ viewBox: "0 0 100 60" }),
}));

function renderLens(
  materialInfluence: number,
  reflectionEnabled = false,
  originalLensColorInfluence = 0,
  extraRender: LensClipRenderSettings = {},
  frameExclusions: Array<Record<string, unknown>> = [
    {
      id: "bridge",
      label: "Bridge",
      pathD: "M 45 10 L 55 10 L 55 20 L 45 20 Z",
      layerOrder: "behind",
      opacity: 100,
    },
  ],
): string {
  return renderToStaticMarkup(
    <SvgClipCompositorView
      view="front"
      plate={{
        plateUrl: "https://cdn.example/frame.png",
        width: 100,
        height: 60,
        clipConfig: {
          version: 1,
          imageWidth: 100,
          imageHeight: 60,
          lenses: [
            {
              id: "lens",
              label: "Lens",
              pathD: "M 10 10 L 90 10 L 90 50 L 10 50 Z",
            },
          ],
          frameExclusions: frameExclusions as never,
          render: {
            automaticMaterialBehavior: false,
            originalLensColorInfluence,
            materialInfluence,
            tintLayerOpacity: 1,
            lensOpacity: 1,
            reflectionEnabled,
            reflectionOpacity: 0.2,
            reflectionStrength: 0.5,
            reflectionBlur: 0.7,
            reflectionPosition: -10,
            reflectionScale: 1.1,
            reflectionAngle: 22,
            internalReflectionEnabled: false,
            fresnelEnabled: false,
            edgeOpacity: 0.2,
            edgeDarkness: 0,
            centerDensity: 0.05,
            edgeDensity: 0.2,
            glassAbsorption: 30,
            glassDiffusion: 18,
            glassDepth: 50,
            baseGlassDarkness: 40,
            baseGlassRichness: 55,
            ...extraRender,
          },
        },
      }}
      tint={{
        name: "Selected tint",
        top: "#8F1830",
        bottom: "#8F1830",
        opacity: 1,
      }}
    />,
  );
}

describe("SvgClipCompositorView prototype glass model", () => {
  it("renders kaca tint stack with customer tint HEX", () => {
    const markup = renderLens(35, true);
    expect(markup).toContain("#8F1830");
    expect(markup).toContain('style="mix-blend-mode:color"');
    expect(markup).toContain('style="mix-blend-mode:soft-light"');
    expect(markup).toContain('style="mix-blend-mode:screen"');
    // No legacy SVG filter glass material path.
    expect(markup).not.toContain("feSpecularLighting");
    expect(markup).not.toContain("glassMaterial");
  });

  it("omits specular when reflection is disabled", () => {
    const disabled = renderLens(35, false);
    const enabled = renderLens(35, true);
    const specularId = /-specular"/;
    expect(disabled.match(specularId) ?? []).toHaveLength(0);
    expect((enabled.match(/-specular"/g) ?? []).length).toBeGreaterThan(0);
  });

  it("replaces the original lens with a glass base (never paints original lens pixels)", () => {
    const markup = renderLens(35);
    expect(markup).not.toContain('data-layer="original-lens"');
    expect(markup).toContain('data-layer="glass-canvas"');
    expect(markup).not.toContain("base-calibration");
    expect(markup).not.toContain('type="saturate"');
    // Plate appears as Frame Back + Manual Details + Frame Front (not as lens fill).
    const plateReferences = markup.match(/https:\/\/cdn\.example\/frame\.png/g) ?? [];
    expect(plateReferences.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps Frame Back / Front and behind-glass structure objects", () => {
    const markup = renderLens(35);
    expect(markup).toContain("frame-back");
    expect(markup).toContain("frame-front");
    expect(markup).toContain("M 45 10 L 55 10 L 55 20 L 45 20 Z");
    expect(markup).toContain('fill-rule="evenodd"');
    expect(markup).not.toContain('clip-rule="evenodd"');
  });

  it("renders Automatic Inner Frame as a plate-masked even-odd ring", () => {
    const markup = renderLens(35, false, 0, {
      innerFrameEnabled: true,
      innerFrameThickness: 3,
      innerFrameOpacity: 70,
      innerFrameFeather: 0,
    });
    expect(markup).toContain('data-layer="automatic-inner-frame"');
    expect(markup).toContain("M 10 10 L 90 10 L 90 50 L 10 50 Z");
  });

  it("omits Automatic Inner Frame when disabled", () => {
    const markup = renderLens(35, false, 0, { innerFrameEnabled: false });
    expect(markup).not.toContain('data-layer="automatic-inner-frame"');
  });

  it("still cuts lens holes and inserts clear glass when material layers are off", () => {
    const markup = renderLens(35, false, 0, {
      glassTintEnabled: false,
      tintLayerOpacity: 0,
      darkLayerEnabled: false,
      darkLayerOpacity: 0,
      edgeEnabled: false,
      edgeDensity: 0,
      edgeOpacity: 0,
      glassTintShine: 0,
      backgroundVisibility: 0,
      environmentTransparency: 0,
      lensOpacity: 0,
      lensTransmission: 1,
      glassDepth: 0,
    });
    expect(markup).toContain("frame-back");
    expect(markup).toContain('data-layer="glass-canvas"');
    expect(markup).not.toContain('data-layer="original-lens"');
    expect(markup).not.toContain("mix-blend-mode:color");
  });

  it("uses the glass sheet base when a sheet URL is configured", () => {
    const markup = renderLens(35, true, 0, {
      glassSheetUrl: "https://cdn.example/sheet.png",
      glassSheetTextureStrength: 55,
      glassSheetShine: 40,
    });
    expect(markup).toContain('data-layer="glass-sheet"');
    expect(markup).toContain("https://cdn.example/sheet.png");
    expect(markup).not.toContain('data-layer="original-lens"');
    expect(markup).not.toContain('data-layer="glass-canvas"');
  });

  it("supports internal glass debug stages without painting original lens", () => {
    const original = renderLens(35, true, 0, { glassDebugStage: "original" });
    expect(original).toContain('data-layer="debug-original"');
    expect(original).not.toContain('data-layer="glass-canvas"');

    const base = renderLens(35, true, 0, { glassDebugStage: "glass-base" });
    expect(base).toContain('data-layer="glass-canvas"');
    expect(base).not.toContain('data-layer="glass-reflection"');
    expect(base).not.toContain('data-layer="lens-edge"');

    const tintOnly = renderLens(35, true, 0, { glassDebugStage: "glass-tint" });
    expect(tintOnly).toContain('data-layer="glass-canvas"');
    expect(tintOnly).toContain("#8F1830");
    expect(tintOnly).not.toContain('data-layer="glass-reflection"');
  });

  it("creates independent glass defs per lens opening", () => {
    const markup = renderToStaticMarkup(
      <SvgClipCompositorView
        view="front"
        plate={{
          plateUrl: "https://cdn.example/frame.png",
          width: 100,
          height: 60,
          clipConfig: {
            version: 1,
            imageWidth: 100,
            imageHeight: 60,
            lenses: [
              { id: "left", label: "Left", pathD: "M 5 10 L 45 10 L 45 50 L 5 50 Z" },
              { id: "right", label: "Right", pathD: "M 55 10 L 95 10 L 95 50 L 55 50 Z" },
            ],
            render: {
              automaticMaterialBehavior: false,
              tintLayerOpacity: 1,
              lensOpacity: 1,
              reflectionEnabled: true,
              glassAbsorption: 30,
              glassDepth: 50,
              edgeDensity: 0.2,
              edgeOpacity: 0.2,
            },
          },
        }}
        tint={{ name: "Tint", top: "#224466", bottom: "#224466", opacity: 1 }}
      />,
    );
    expect(markup).toContain("pg-left");
    expect(markup).toContain("pg-right");
    expect(markup).toContain("glass-left");
    expect(markup).toContain("glass-right");
  });

  it("plateOnly skips all lens compositing and shows the plate as-is", () => {
    const markup = renderToStaticMarkup(
      <SvgClipCompositorView
        view="front"
        plateOnly
        plate={{
          plateUrl: "https://cdn.example/original.png",
          width: 100,
          height: 60,
          clipConfig: {
            version: 1,
            imageWidth: 100,
            imageHeight: 60,
            lenses: [
              { id: "lens", label: "Lens", pathD: "M 10 10 L 90 10 L 90 50 L 10 50 Z" },
            ],
            frameExclusions: [
              {
                id: "bridge",
                label: "Bridge",
                pathD: "M 45 10 L 55 10 L 55 20 L 45 20 Z",
                layerOrder: "front",
                opacity: 100,
              },
            ],
            render: {
              glassSheetUrl: "https://cdn.example/sheet.png",
              tintLayerOpacity: 1,
              reflectionEnabled: true,
              darkLayerEnabled: true,
            },
          },
        }}
        tint={{ name: "Tint", top: "#8F1830", bottom: "#8F1830", opacity: 1 }}
      />,
    );
    expect(markup).toContain("https://cdn.example/original.png");
    expect(markup).not.toContain("frame-back");
    expect(markup).not.toContain("glassSheet");
    expect(markup).not.toContain("https://cdn.example/sheet.png");
    expect(markup).not.toContain("mix-blend-mode");
    expect(markup).not.toContain("#8F1830");
    expect((markup.match(/<image /g) ?? []).length).toBe(1);
  });
});
