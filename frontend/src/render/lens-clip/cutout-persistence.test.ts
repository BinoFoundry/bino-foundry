import { describe, expect, it } from "vitest";

import { createFramePart, createCutoutFromPreset } from "@/features/admin/lib/frame-parts";
import { mergeMaskIntoView } from "@/features/admin/lib/frame-render-flush";
import { serializeRenderViewsForApi } from "@/lib/frame-render-views";
import {
  createLensPolygon,
  createMaskConfig,
  resolveMaskFrameExclusions,
} from "@/render/mask/mask-types";
import type { FrameRenderView } from "@/types/frame-rendering";

import { enrichMaskHolesFromSource, resolveMaskConfigForEditor } from "./mask-for-editor";

describe("cutout persistence lifecycle", () => {
  function makeMaskWithCutout() {
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
    const part = createFramePart("Rivet", "rectangle");
    part.holes = [
      createCutoutFromPreset(part.points, "ellipse", "Cutout 1"),
      createCutoutFromPreset(part.points, "rectangle", "Cutout 2"),
    ];
    return createMaskConfig(1000, 500, [left, right], undefined, [part]);
  }

  it("keeps holes through mergeMaskIntoView + serialize + resolve", () => {
    const mask = makeMaskWithCutout();
    expect(resolveMaskFrameExclusions(mask)[0]?.holes).toHaveLength(2);

    const view: FrameRenderView = {
      view: "front",
      plateUrl: "https://example.com/front.png",
      width: 1000,
      height: 500,
      clipConfig: null,
      clipStatus: "draft",
      maskConfig: null,
      maskStatus: "draft",
    };
    const merged = mergeMaskIntoView(view, mask);
    expect(merged.maskConfig?.frameExclusions?.[0]?.holes).toHaveLength(2);
    expect(merged.clipConfig?.frameExclusions?.[0]?.holePathDs).toHaveLength(2);

    const serialized = serializeRenderViewsForApi([merged]);
    expect(serialized[0]?.maskConfig?.frameExclusions?.[0]?.holes).toHaveLength(2);
    expect(
      (serialized[0]?.clipConfig as { frameExclusions?: { holePathDs?: string[] }[] } | null)
        ?.frameExclusions?.[0]?.holePathDs,
    ).toHaveLength(2);

    const loaded: FrameRenderView = {
      ...view,
      maskConfig: serialized[0]!.maskConfig,
      clipConfig: serialized[0]!.clipConfig,
      maskStatus: "ready",
      clipStatus: "ready",
    };
    const resolved = resolveMaskConfigForEditor(loaded);
    expect(resolveMaskFrameExclusions(resolved)[0]?.holes).toHaveLength(2);
  });

  it("restores holes from clip when preferred mask lost them", () => {
    const mask = makeMaskWithCutout();
    const view: FrameRenderView = {
      view: "front",
      plateUrl: "https://example.com/front.png",
      width: 1000,
      height: 500,
      clipConfig: null,
      clipStatus: "draft",
      maskConfig: null,
      maskStatus: "draft",
    };
    const merged = mergeMaskIntoView(view, mask);
    const outer = resolveMaskFrameExclusions(mask)[0]!;
    const staleMask = createMaskConfig(1000, 500, mask.lenses, undefined, [
      { ...outer, holes: [] },
    ]);
    const desynced: FrameRenderView = {
      ...view,
      maskConfig: staleMask,
      clipConfig: merged.clipConfig,
      maskStatus: "ready",
      clipStatus: "ready",
    };
    const fixed = resolveMaskConfigForEditor(desynced);
    expect(resolveMaskFrameExclusions(fixed)[0]?.holes?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps preferred holes when both mask and clip have cutouts", () => {
    const mask = makeMaskWithCutout();
    const preferredHoleId = resolveMaskFrameExclusions(mask)[0]!.holes![0]!.id;
    const fromClip = createMaskConfig(1000, 500, mask.lenses, undefined, [
      {
        ...resolveMaskFrameExclusions(mask)[0]!,
        holes: [
          createCutoutFromPreset(
            resolveMaskFrameExclusions(mask)[0]!.points,
            "rectangle",
            "From clip",
          ),
        ],
      },
    ]);
    const enriched = enrichMaskHolesFromSource(mask, fromClip);
    expect(resolveMaskFrameExclusions(enriched)[0]?.holes).toHaveLength(2);
    expect(resolveMaskFrameExclusions(enriched)[0]?.holes?.[0]?.id).toBe(preferredHoleId);
  });

  it("restores cutouts from clip-only views (no maskConfig)", () => {
    const mask = makeMaskWithCutout();
    const clip = mergeMaskIntoView(
      {
        view: "side",
        plateUrl: "https://example.com/side.png",
        width: 800,
        height: 400,
        clipConfig: null,
        clipStatus: "draft",
        maskConfig: null,
        maskStatus: "draft",
      },
      mask,
    ).clipConfig;
    const loaded: FrameRenderView = {
      view: "side",
      plateUrl: "https://example.com/side.png",
      width: 800,
      height: 400,
      clipConfig: clip,
      clipStatus: "ready",
      maskConfig: null,
      maskStatus: "draft",
    };
    const resolved = resolveMaskConfigForEditor(loaded);
    expect(resolveMaskFrameExclusions(resolved)[0]?.holes?.length).toBeGreaterThanOrEqual(2);
  });
});
