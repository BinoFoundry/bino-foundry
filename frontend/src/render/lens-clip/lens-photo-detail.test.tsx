import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveLensClipRenderSettings } from "./clip-settings";
import { LensPhotoDetailElement } from "./LensPhotoDetailElement";

const LENS = { id: "left", label: "Left", pathD: "M 0 0 L 100 0 L 100 80 L 0 80 Z" };
const draw = (strength: number | undefined) =>
  renderToStaticMarkup(
    <svg>
      <LensPhotoDetailElement
        uid="u1"
        lens={LENS as never}
        plateUrl="https://example.test/plate.png"
        w={1920}
        h={1080}
        render={resolveLensClipRenderSettings(null, { lensDetailStrength: strength })}
      />
    </svg>,
  );

describe("lensDetailStrength", () => {
  it("survives resolution instead of being dropped", () => {
    expect(resolveLensClipRenderSettings(null, { lensDetailStrength: 0.6 }).lensDetailStrength).toBe(0.6);
  });

  it("defaults to off", () => {
    expect(resolveLensClipRenderSettings(null, {}).lensDetailStrength).toBe(0);
  });

  it("clamps rather than dropping out-of-range values", () => {
    expect(resolveLensClipRenderSettings(null, { lensDetailStrength: 5 }).lensDetailStrength).toBe(1);
    expect(resolveLensClipRenderSettings(null, { lensDetailStrength: -3 }).lensDetailStrength).toBe(0);
  });
});

describe("LensPhotoDetailElement", () => {
  it("draws nothing when the strength is zero", () => {
    expect(draw(0)).toBe("<svg></svg>");
  });

  it("draws the plate through a high-pass filter when enabled", () => {
    const html = draw(0.6);
    expect(html).toContain('data-layer="lens-photo-detail"');
    expect(html).toContain("feGaussianBlur");
    expect(html).toContain('operator="arithmetic"');
    expect(html).toContain('opacity="0.6"');
    expect(html).toContain("soft-light");
  });

  it("keeps only shading, never the plate's own colour", () => {
    // a saturate:0 pass is what stops the photographed lens tinting the result
    expect(draw(0.6)).toContain('type="saturate"');
  });

  it("clips the detail to the lens opening", () => {
    expect(draw(0.6)).toContain('clip-path="url(#u1-glass-left)"');
  });

  it("scales the blur with the plate so it is resolution independent", () => {
    const wide = renderToStaticMarkup(
      <svg>
        <LensPhotoDetailElement
          uid="u1" lens={LENS as never} plateUrl="p.png" w={3840} h={2160}
          render={resolveLensClipRenderSettings(null, { lensDetailStrength: 0.6 })}
        />
      </svg>,
    );
    const of = (s: string) => Number(/stdDeviation="([\d.]+)"/.exec(s)?.[1]);
    expect(of(wide)).toBeCloseTo(of(draw(0.6)) * 2, 5);
  });
});
