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
          frameExclusions: [
            {
              id: "bridge",
              label: "Bridge",
              pathD: "M 45 10 L 55 10 L 55 20 L 45 20 Z",
            },
          ],
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

describe("SvgClipCompositorView glass material filter", () => {
  it("applies one reusable glassMaterial filter to the tinted lens path", () => {
    const markup = renderLens(35, true);
    expect(markup).toContain("glassMaterial");
    expect(markup).toContain('filter="url(#');
    expect(markup).toContain("#8F1830");
    expect(markup).toContain("feSpecularLighting");
    // No stacked named overlay groups.
    expect(markup).not.toContain("glass-internal-reflection");
    expect(markup).not.toContain("glass-fresnel");
  });

  it("omits specular reflection primitives when reflection is disabled", () => {
    const disabled = renderLens(35, false);
    const enabled = renderLens(35, true);
    expect(disabled).not.toContain("feSpecularLighting");
    expect(enabled).toContain("feSpecularLighting");
  });

  it("removes source chroma before tinting through the foundation calibration filter", () => {
    const markup = renderLens(35);
    expect(markup).toContain('type="saturate" values="0"');
    expect(markup).toContain("#8F1830");
  });

  it("controls only source chroma in the existing luminance extraction filter", () => {
    const neutral = renderLens(35, false, 0);
    const recommended = renderLens(35, false, 15);
    const preserved = renderLens(35, false, 100);
    expect(neutral).toContain('type="saturate" values="0"');
    expect(recommended).toContain('type="saturate" values="0.15"');
    expect(preserved).toContain('type="saturate" values="1"');
  });

  it("keeps frame body, lens foundation, and exclusions on the one original plate", () => {
    const markup = renderLens(35);
    const plateReferences = markup.match(/https:\/\/cdn\.example\/frame\.png/g) ?? [];
    expect(plateReferences.length).toBeGreaterThanOrEqual(3);
  });

  it("reuses a single glassMaterial filter definition for every lens opening", () => {
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
    const filterDefs = markup.match(/id="[^"]*-glassMaterial"/g) ?? [];
    expect(filterDefs).toHaveLength(1);
    const filteredPaths = markup.match(/filter="url\(#[^"]*-glassMaterial\)"/g) ?? [];
    expect(filteredPaths.length).toBe(2);
  });
});
