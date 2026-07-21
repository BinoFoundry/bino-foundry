import { describe, expect, it } from "vitest";

import { createLensClipConfig } from "@bino-foundry/shared/types";

import { flushFrameRenderViews, mergeMaskIntoView } from "./frame-render-flush";
import { createMaskConfig } from "@/render/mask";
import type { FrameRenderView } from "@/types/frame-rendering";

const baseView = (axis: FrameRenderView["view"]): FrameRenderView => ({
  view: axis,
  plateUrl: "https://example.com/plate.jpg",
  width: 800,
  height: 600,
  originalPlateUrl: "https://example.com/plate.jpg",
  originalWidth: 800,
  originalHeight: 600,
  clipConfig: null,
  clipStatus: "draft",
  maskConfig: null,
  maskStatus: "draft",
});

describe("frame-render-flush", () => {
  it("merges mask into view with clip config", () => {
    const mask = createMaskConfig(800, 600, [
      { id: "left", label: "Left", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] },
      { id: "right", label: "Right", points: [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }] },
    ]);

    const merged = mergeMaskIntoView(baseView("front"), mask);
    expect(merged.maskConfig).toEqual(mask);
    expect(merged.clipConfig?.lenses.length).toBeGreaterThan(0);
  });

  it("preserves clip render settings when rebuilding clip config from mask", () => {
    const render = {
      lensOpacity: 0.88,
      lensTransmission: 0.46,
      reflectionStrength: 0.35,
      edgeDarkness: 0.22,
      edgeWidth: 0.007,
    };
    const view = {
      ...baseView("front"),
      clipConfig: createLensClipConfig(
        800,
        600,
        [{ id: "left", label: "Left", pathD: "M0 0 L10 0 L10 10 Z" }],
        render,
      ),
    };
    const mask = createMaskConfig(800, 600, [
      { id: "left", label: "Left", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] },
      { id: "right", label: "Right", points: [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }] },
    ]);

    const merged = mergeMaskIntoView(view, mask);
    expect(merged.clipConfig?.render).toMatchObject(render);
  });

  it("flushes pending mask drafts into render views", () => {
    const views = [baseView("front"), baseView("side")];
    const mask = createMaskConfig(800, 600, [
      { id: "left", label: "Left", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] },
      { id: "right", label: "Right", points: [{ x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }] },
    ]);

    const flushed = flushFrameRenderViews(views, { maskByAxis: { front: mask } });
    expect(flushed.find((v) => v.view === "front")?.maskConfig).toEqual(mask);
    expect(flushed.find((v) => v.view === "side")?.maskConfig).toBeNull();
  });
});
