import { describe, expect, it } from "vitest";

import type { FrameEntry } from "@/data/glasses";
import { createLensPolygon, createMaskConfig } from "@/render/mask";

import { buildFrameDuplicateSeed, copyFrontGeometryToSideMask } from "./frame-duplicate";

describe("buildFrameDuplicateSeed", () => {
  it("resets identity and suffixes the name", () => {
    const source: FrameEntry = {
      id: "frame-1",
      name: "Aviator 52",
      price: 120,
      description: "Classic",
      isActive: true,
      availabilityStatusCode: "ACTIVE",
      displayOrder: 3,
      modelFamily: "Aviator Classic",
      lensRenderPresetId: "preset-1",
      useLensRenderPreset: true,
      renderViews: [
        {
          id: "view-front",
          view: "front",
          plateUrl: "https://cdn.example/front.png",
          width: 800,
          height: 400,
          clipStatus: "ready",
        },
      ],
    };

    const seed = buildFrameDuplicateSeed(source);
    expect(seed.id).toBe("");
    expect(seed.name).toBe("Aviator 52 (copy)");
    expect(seed.modelFamily).toBe("Aviator Classic");
    expect(seed.price).toBe(120);
    expect(seed.lensRenderPresetId).toBe("preset-1");
    expect(seed.renderViews?.[0]?.id).toBeUndefined();
    expect(seed.renderViews?.[0]?.plateUrl).toBe("https://cdn.example/front.png");
  });
});

describe("copyFrontGeometryToSideMask", () => {
  it("retargets normalized geometry onto the side plate size", () => {
    const left = createLensPolygon("left", "Left", [
      { x: 0.1, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.4, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.25, y: 0.5, curved: false, handleIn: null, handleOut: null },
    ]);
    const right = createLensPolygon("right", "Right", [
      { x: 0.6, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.9, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.75, y: 0.5, curved: false, handleIn: null, handleOut: null },
    ]);
    const detail = createLensPolygon("rivet", "Rivet", [
      { x: 0.48, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.52, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.5, y: 0.45, curved: false, handleIn: null, handleOut: null },
    ], { layerOrder: "front" });
    const front = createMaskConfig(1000, 500, [left, right], undefined, [detail]);

    const side = copyFrontGeometryToSideMask(front, 640, 480);
    expect(side).not.toBeNull();
    expect(side!.imageWidth).toBe(640);
    expect(side!.imageHeight).toBe(480);
    expect(side!.lenses).toHaveLength(2);
    expect(side!.lenses[0]?.points[0]?.x).toBeCloseTo(0.1);
    expect(side!.frameExclusions?.[0]?.id).toMatch(/^side-/);
  });

  it("returns null without a usable source mask", () => {
    expect(copyFrontGeometryToSideMask(null, 100, 100)).toBeNull();
  });
});
