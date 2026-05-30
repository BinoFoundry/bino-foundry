import { describe, expect, it } from "vitest";

import { isFrameViewClipReady, resolveLensClipConfig } from "@/render/lens-clip";
import { lensTintEntryToGradient } from "@/render/state/sunglasses-render-reducer";
import type { FrameRenderView } from "@/types/frame-rendering";

describe("resolveLensClipConfig", () => {
  it("returns valid clipConfig when present", () => {
    const clipConfig = {
      version: 1 as const,
      imageWidth: 100,
      imageHeight: 100,
      lenses: [{ id: "l1", label: "Left", pathD: "M0 0 L100 0 L100 100 Z" }],
    };
    const result = resolveLensClipConfig({ clipConfig, width: 100, height: 100 });
    expect(result?.lenses).toHaveLength(1);
  });

  it("returns null when no clip data", () => {
    expect(resolveLensClipConfig({})).toBeNull();
  });
});

describe("isFrameViewClipReady", () => {
  it("requires plate and valid clip", () => {
    const view: FrameRenderView = {
      view: "front",
      plateUrl: "https://example.com/plate.jpg",
      width: 800,
      height: 600,
      clipStatus: "ready",
      clipConfig: {
        version: 1,
        imageWidth: 800,
        imageHeight: 600,
        lenses: [{ id: "l1", label: "Left", pathD: "M0 0 L800 0 L800 600 Z" }],
      },
    };
    expect(isFrameViewClipReady(view)).toBe(true);
  });

  it("is false without plate", () => {
    expect(
      isFrameViewClipReady({
        view: "front",
        plateUrl: "",
        width: 800,
        height: 600,
      }),
    ).toBe(false);
  });
});

describe("lensTintEntryToGradient", () => {
  it("maps catalog tint to compositor gradient", () => {
    const gradient = lensTintEntryToGradient({
      id: "1",
      code: "OCEAN",
      name: "Ocean",
      category: "gradient",
      gradientTop: "#112233",
      gradientBottom: "#445566",
      priceSurcharge: 5,
      displayOrder: 0,
      isActive: true,
    });
    expect(gradient).toEqual({
      name: "Ocean",
      top: "#112233",
      bottom: "#445566",
    });
  });
});
