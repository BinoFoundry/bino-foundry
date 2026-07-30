import { describe, expect, it } from "vitest";

import type { FrameEntry } from "@/data/glasses";
import { createLensPolygon, createMaskConfig } from "@/render/mask";

import {
  applyFrameConfigCopy,
  detectFrameConfigCopyConflicts,
  EMPTY_FRAME_CONFIG_COPY_SELECTION,
  filterFramePickerItems,
  resolveFrameConfigCopyFlags,
  retargetCropConfig,
} from "./frame-config-copy";

function sampleMask() {
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
  const detail = createLensPolygon(
    "rivet",
    "Rivet",
    [
      { x: 0.48, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.52, y: 0.4, curved: false, handleIn: null, handleOut: null },
      { x: 0.5, y: 0.45, curved: false, handleIn: null, handleOut: null },
    ],
    { layerOrder: "front", opacity: 80, visible: true },
  );
  return createMaskConfig(1000, 500, [left, right], undefined, [detail]);
}

function sourceFrame(): FrameEntry {
  return {
    id: "src",
    name: "Aviator 52",
    price: 100,
    description: "",
    modelFamily: "Aviator Classic",
    lensRenderPresetId: "preset-src",
    useLensRenderPreset: false,
    renderViews: [
      {
        view: "front",
        plateUrl: "https://cdn.example/src-front.png",
        width: 1000,
        height: 500,
        originalPlateUrl: "https://cdn.example/src-front-orig.png",
        originalWidth: 1000,
        originalHeight: 500,
        plateCropConfig: {
          version: 2,
          imageWidth: 1000,
          imageHeight: 500,
          originalUrl: "https://cdn.example/src-front-orig.png",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.1, y: 0.9 },
          ],
          scale: 1.05,
        },
        maskConfig: sampleMask(),
        maskStatus: "ready",
        clipConfig: {
          version: 1,
          imageWidth: 1000,
          imageHeight: 500,
          lenses: [{ id: "left", label: "Left", pathD: "M10 10 L100 10 L50 80 Z" }],
          frameExclusions: [
            { id: "rivet", label: "Rivet", pathD: "M40 40 L60 40 L50 55 Z", opacity: 80 },
          ],
          render: {
            glassSheetUrl: "https://cdn.example/sheet.png",
            glassSheetScale: 1.2,
            glassSheetOffsetX: 2,
            tintOpacity: 0.7,
            reflectionEnabled: true,
            materialInfluence: 40,
            baseGlassDarkness: 25,
          },
        },
        clipStatus: "ready",
      },
      {
        view: "side",
        plateUrl: "https://cdn.example/src-side.png",
        width: 800,
        height: 400,
        maskConfig: sampleMask(),
        clipConfig: {
          version: 1,
          imageWidth: 800,
          imageHeight: 400,
          lenses: [{ id: "left", label: "Left", pathD: "M10 10 L80 10 L40 70 Z" }],
          render: { tintOpacity: 0.5 },
        },
      },
    ],
  };
}

function destFrame(): FrameEntry {
  return {
    id: "dest",
    name: "Aviator 54",
    price: 120,
    description: "variant",
    modelFamily: "Aviator Classic",
    lensRenderPresetId: "preset-dest",
    useLensRenderPreset: true,
    renderViews: [
      {
        view: "front",
        plateUrl: "https://cdn.example/dest-front.png",
        width: 1200,
        height: 600,
        originalPlateUrl: "https://cdn.example/dest-front-orig.png",
        originalWidth: 1200,
        originalHeight: 600,
      },
      {
        view: "side",
        plateUrl: "https://cdn.example/dest-side.png",
        width: 900,
        height: 450,
      },
    ],
  };
}

describe("resolveFrameConfigCopyFlags", () => {
  it("expands everything", () => {
    const flags = resolveFrameConfigCopyFlags({
      ...EMPTY_FRAME_CONFIG_COPY_SELECTION,
      everything: true,
    });
    expect(flags.crop).toBe(true);
    expect(flags.lensPolygon).toBe(true);
    expect(flags.manualDetails).toBe(true);
    expect(flags.glassSheet).toBe(true);
    expect(flags.presetAssignment).toBe(true);
  });

  it("expands allRendering into render subsections", () => {
    const flags = resolveFrameConfigCopyFlags({
      ...EMPTY_FRAME_CONFIG_COPY_SELECTION,
      allRendering: true,
    });
    expect(flags.crop).toBe(false);
    expect(flags.glassSheet).toBe(true);
    expect(flags.lensRendering).toBe(true);
    expect(flags.glassMaterial).toBe(true);
  });
});

describe("retargetCropConfig", () => {
  it("keeps geometry but binds to destination plate URLs", () => {
    const source = sourceFrame().renderViews![0]!;
    const dest = destFrame().renderViews![0]!;
    const next = retargetCropConfig(source.plateCropConfig!, dest);
    expect(next.version).toBe(2);
    if (next.version === 2) {
      expect(next.points).toHaveLength(4);
      expect(next.scale).toBe(1.05);
      expect(next.originalUrl).toBe("https://cdn.example/dest-front-orig.png");
      expect(next.processedUrl).toBeUndefined();
      expect(next.imageWidth).toBe(1200);
      expect(next.imageHeight).toBe(600);
    }
  });
});

describe("applyFrameConfigCopy", () => {
  it("copies crop + lens + details without replacing destination plate URLs", () => {
    const result = applyFrameConfigCopy({
      source: sourceFrame(),
      destination: destFrame(),
      selection: {
        ...EMPTY_FRAME_CONFIG_COPY_SELECTION,
        crop: true,
        lensPolygon: true,
        manualDetails: true,
      },
    });

    const front = result.renderViews.find((v) => v.view === "front")!;
    expect(front.plateUrl).toBe("https://cdn.example/dest-front.png");
    expect(front.originalPlateUrl).toBe("https://cdn.example/dest-front-orig.png");
    expect(front.plateCropConfig?.version).toBe(2);
    expect(front.maskConfig?.lenses[0]?.points[0]?.x).toBeCloseTo(0.1);
    expect(front.maskConfig?.imageWidth).toBe(1200);
    expect(front.maskConfig?.frameExclusions?.[0]?.label).toBe("Rivet");
    expect(front.clipConfig?.lenses?.length).toBeGreaterThan(0);
    expect(result.lensRenderPresetId).toBe("preset-dest");
  });

  it("copies glass sheet keys without wiping unrelated render settings", () => {
    const destination = destFrame();
    destination.renderViews = destination.renderViews!.map((v) =>
      v.view === "front"
        ? {
            ...v,
            clipConfig: {
              version: 1,
              imageWidth: 1200,
              imageHeight: 600,
              lenses: [{ id: "left", label: "Left", pathD: "M1 1 L2 1 L1 2 Z" }],
              render: { tintOpacity: 0.2, reflectionEnabled: false },
            },
          }
        : v,
    );

    const result = applyFrameConfigCopy({
      source: sourceFrame(),
      destination,
      selection: { ...EMPTY_FRAME_CONFIG_COPY_SELECTION, glassSheet: true },
    });

    const render = result.renderViews.find((v) => v.view === "front")!.clipConfig!.render!;
    expect(render.glassSheetUrl).toBe("https://cdn.example/sheet.png");
    expect(render.glassSheetScale).toBe(1.2);
    expect(render.tintOpacity).toBe(0.2);
    expect(render.reflectionEnabled).toBe(false);
  });

  it("merges manual details instead of replacing when mode is merge", () => {
    const destination = destFrame();
    const existing = createLensPolygon(
      "logo",
      "Logo",
      [
        { x: 0.2, y: 0.2, curved: false, handleIn: null, handleOut: null },
        { x: 0.3, y: 0.2, curved: false, handleIn: null, handleOut: null },
        { x: 0.25, y: 0.3, curved: false, handleIn: null, handleOut: null },
      ],
      { layerOrder: "front" },
    );
    destination.renderViews = destination.renderViews!.map((v) =>
      v.view === "front"
        ? {
            ...v,
            maskConfig: createMaskConfig(1200, 600, sampleMask().lenses, undefined, [existing]),
          }
        : v,
    );

    const result = applyFrameConfigCopy({
      source: sourceFrame(),
      destination,
      selection: { ...EMPTY_FRAME_CONFIG_COPY_SELECTION, manualDetails: true },
      conflictMode: "merge",
    });

    const details = result.renderViews.find((v) => v.view === "front")!.maskConfig!.frameExclusions!;
    expect(details.map((d) => d.label).sort()).toEqual(["Logo", "Rivet"]);
  });
});

describe("detectFrameConfigCopyConflicts", () => {
  it("flags sections that already have destination data", () => {
    const destination = destFrame();
    destination.renderViews = destination.renderViews!.map((v) =>
      v.view === "front"
        ? { ...v, maskConfig: sampleMask(), plateCropConfig: sourceFrame().renderViews![0]!.plateCropConfig }
        : v,
    );

    const conflicts = detectFrameConfigCopyConflicts(destination, {
      ...EMPTY_FRAME_CONFIG_COPY_SELECTION,
      crop: true,
      lensPolygon: true,
      manualDetails: true,
    });
    expect(conflicts).toEqual(expect.arrayContaining(["crop", "lensPolygon", "manualDetails"]));
  });
});

describe("filterFramePickerItems", () => {
  it("filters by family and query", () => {
    const items = filterFramePickerItems(
      [
        { ...sourceFrame(), updatedAt: "2026-01-02T00:00:00Z" },
        { ...destFrame(), name: "Wayfarer 50", modelFamily: "Wayfarer", updatedAt: "2026-01-03T00:00:00Z" },
      ],
      { query: "aviator", family: "Aviator Classic", excludeId: "dest" },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("src");
  });
});
