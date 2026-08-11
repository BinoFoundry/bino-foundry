import { describe, expect, it } from "vitest";

import {
  applyExpand,
  applyFeather,
  createSmartCutoutFramePart,
  createSmartCutoutFrameParts,
  createSmartCutoutHole,
  createSmartCutoutHoles,
  detectBorderPx,
  detectSmartCutout,
  dilateMask,
  fillMaskHoles,
  finalizeSmartMask,
  parseSmartCutoutNotes,
  patchCutoutDetectSettings,
  regionGrowFromSeed,
  removeAreaAtPoint,
  smartResultIslands,
  subtractMasks,
  unionMasks,
  withDetectBorderPx,
} from "./smart-cutout-detect";

function makeSolidDiskImage(
  width: number,
  height: number,
  disks: Array<{ cx: number; cy: number; radius: number; color?: [number, number, number] }>,
  bg: [number, number, number] = [40, 45, 50],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let color = bg;
      for (const disk of disks) {
        if ((x - disk.cx) ** 2 + (y - disk.cy) ** 2 <= disk.radius ** 2) {
          color = disk.color ?? [180, 140, 90];
          break;
        }
      }
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("smart-cutout-detect", () => {
  it("grows a compact disk from a seed click", () => {
    const image = makeSolidDiskImage(64, 64, [{ cx: 32, cy: 32, radius: 8 }]);
    const grown = regionGrowFromSeed(image, 32, 32, 20, 64 * 64 * 0.2);
    expect(grown).not.toBeNull();
    expect(grown!.areaPx).toBeGreaterThan(40);
    expect(grown!.areaPx).toBeLessThan(300);
  });

  it("detects anchors for a rivet-like blob", () => {
    const image = makeSolidDiskImage(
      80,
      80,
      [{ cx: 40, cy: 40, radius: 7, color: [210, 200, 180] }],
      [30, 32, 38],
    );
    const result = detectSmartCutout({
      imageData: image,
      seed: { x: 40, y: 40 },
      params: { tolerance: 24, feather: 1, expand: 0, shrink: 0, smoothEdge: 1 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBeGreaterThanOrEqual(3);
    expect(result.coreMask).toBeTruthy();
    expect(result.seeds.length).toBe(1);
    const part = createSmartCutoutFramePart(result, "Smart Cutout 1");
    expect(part.points.length).toBeGreaterThanOrEqual(3);
    expect(part.layerOrder).toBe("front");
    const parsed = parseSmartCutoutNotes(part.notes);
    expect(parsed.meta?.source).toBe("smart");
    expect(parsed.meta?.tolerance).toBe(24);
    expect(parsed.meta?.expand).toBe(0);
    expect(parsed.meta?.shrink).toBe(0);
    expect(parsed.meta?.seedsNorm?.length).toBe(1);
  });

  it("merges a second area into the same cutout", () => {
    const image = makeSolidDiskImage(
      100,
      60,
      [
        { cx: 25, cy: 30, radius: 6, color: [200, 180, 140] },
        { cx: 75, cy: 30, radius: 6, color: [200, 180, 140] },
      ],
      [25, 28, 32],
    );
    const first = detectSmartCutout({
      imageData: image,
      seed: { x: 25, y: 30 },
      params: { tolerance: 30, feather: 0, expand: 0, smoothEdge: 0 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const merged = detectSmartCutout({
      imageData: image,
      seed: { x: 75, y: 30 },
      existingCore: first.coreMask,
      existingSeeds: first.seeds,
      params: { tolerance: 30, feather: 0, expand: 0, smoothEdge: 0 },
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.seeds.length).toBe(2);
    expect(merged.regions.length).toBeGreaterThanOrEqual(1);
    expect(merged.areaPx).toBeGreaterThan(first.areaPx);
  });

  it("removes an area from a merged cutout", () => {
    const image = makeSolidDiskImage(
      100,
      60,
      [
        { cx: 25, cy: 30, radius: 6, color: [200, 180, 140] },
        { cx: 75, cy: 30, radius: 6, color: [200, 180, 140] },
      ],
      [25, 28, 32],
    );
    const first = detectSmartCutout({
      imageData: image,
      seed: { x: 25, y: 30 },
      params: { tolerance: 30, feather: 0, expand: 0 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const merged = detectSmartCutout({
      imageData: image,
      seed: { x: 75, y: 30 },
      existingCore: first.coreMask,
      existingSeeds: first.seeds,
      params: { tolerance: 30, feather: 0, expand: 0 },
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const removed = removeAreaAtPoint({
      coreMask: merged.coreMask,
      width: 100,
      height: 60,
      x: 75,
      y: 30,
      seeds: merged.seeds,
      params: merged.params,
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.areaPx).toBeLessThan(merged.areaPx);
  });

  it("creates hole geometry from the same detection", () => {
    const image = makeSolidDiskImage(64, 64, [{ cx: 20, cy: 20, radius: 5 }]);
    const result = detectSmartCutout({
      imageData: image,
      seed: { x: 20, y: 20 },
      params: { tolerance: 30, feather: 0 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hole = createSmartCutoutHole(result, "Cutout 1");
    expect(hole.id.startsWith("smart-hole-")).toBe(true);
    expect(hole.points.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects runaway floods when tolerance is huge on flat images", () => {
    const image = makeSolidDiskImage(40, 40, [{ cx: 20, cy: 20, radius: 100, color: [50, 50, 50] }], [
      50, 50, 50,
    ]);
    const result = detectSmartCutout({
      imageData: image,
      seed: { x: 20, y: 20 },
      params: { tolerance: 10, feather: 0, maxAreaFraction: 0.05 },
    });
    expect(result.ok).toBe(false);
  });

  it("expands selection and fills holes", () => {
    const width = 20;
    const height = 20;
    const mask = new Uint8Array(width * height);
    for (let y = 4; y <= 15; y++) {
      for (let x = 4; x <= 15; x++) mask[y * width + x] = 1;
    }
    for (let y = 8; y <= 11; y++) {
      for (let x = 8; x <= 11; x++) mask[y * width + x] = 0;
    }
    const filled = fillMaskHoles(mask, width, height);
    expect(filled[10 * width + 10]).toBe(1);

    const expanded = applyExpand(mask, width, height, 1);
    expect(expanded[3 * width + 4]).toBe(1);
    const shrunk = applyExpand(mask, width, height, -1);
    expect(shrunk[4 * width + 4]).toBe(0);

    const feathered = applyFeather(mask, width, height, 1);
    expect(feathered[3 * width + 4]).toBe(1);
    expect(dilateMask(mask, width, height, 1)[3 * width + 4]).toBe(1);
  });

  it("unions and subtracts masks", () => {
    const a = new Uint8Array([1, 1, 0, 0]);
    const b = new Uint8Array([0, 1, 1, 0]);
    expect(Array.from(unionMasks(a, b))).toEqual([1, 1, 1, 0]);
    expect(Array.from(subtractMasks(a, b))).toEqual([1, 0, 0, 0]);
  });

  it("finalizes expand without re-detecting", () => {
    const width = 80;
    const height = 80;
    const core = new Uint8Array(width * height);
    for (let y = 35; y <= 44; y++) {
      for (let x = 35; x <= 44; x++) core[y * width + x] = 1;
    }
    const paramsBase = {
      tolerance: 28,
      feather: 0,
      smoothEdge: 0,
      shrink: 0,
      maxAreaFraction: 0.25,
    };
    const tight = finalizeSmartMask(
      core,
      width,
      height,
      { ...paramsBase, expand: 0 },
      [{ x: 40, y: 40 }],
    );
    const wide = finalizeSmartMask(
      core,
      width,
      height,
      { ...paramsBase, expand: 2 },
      [{ x: 40, y: 40 }],
    );
    expect(tight.ok && wide.ok).toBe(true);
    if (!tight.ok || !wide.ok) return;
    expect(wide.areaPx).toBeGreaterThan(tight.areaPx);
  });

  it("stores detection settings per cutout independently", () => {
    const image = makeSolidDiskImage(64, 64, [{ cx: 32, cy: 32, radius: 6 }]);
    const a = detectSmartCutout({
      imageData: image,
      seed: { x: 32, y: 32 },
      params: { tolerance: 18, expand: 2, shrink: 0, feather: 0.6, smoothEdge: 1 },
    });
    const b = detectSmartCutout({
      imageData: image,
      seed: { x: 32, y: 32 },
      params: { tolerance: 24, expand: 1, shrink: 1, feather: 0, smoothEdge: 3 },
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const left = createSmartCutoutFramePart(a, "Left Rivet");
    const right = createSmartCutoutFramePart(b, "Right Rivet");
    expect(parseSmartCutoutNotes(left.notes).meta?.tolerance).toBe(18);
    expect(parseSmartCutoutNotes(right.notes).meta?.tolerance).toBe(24);

    const leftPatched = patchCutoutDetectSettings(left, { tolerance: 12 });
    expect(parseSmartCutoutNotes(leftPatched.notes).meta?.tolerance).toBe(12);
    expect(parseSmartCutoutNotes(right.notes).meta?.tolerance).toBe(24);
    expect(parseSmartCutoutNotes(leftPatched.notes).meta?.expand).toBe(2);
    expect(parseSmartCutoutNotes(right.notes).meta?.smoothEdge).toBe(3);
  });

  it("materializes every Add Area island as its own Manual Detail polygon", () => {
    const image = makeSolidDiskImage(
      100,
      60,
      [
        { cx: 25, cy: 30, radius: 6, color: [200, 180, 140] },
        { cx: 75, cy: 30, radius: 6, color: [200, 180, 140] },
      ],
      [25, 28, 32],
    );
    const first = detectSmartCutout({
      imageData: image,
      seed: { x: 25, y: 30 },
      params: { tolerance: 30, feather: 0, expand: 0, smoothEdge: 0 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const merged = detectSmartCutout({
      imageData: image,
      seed: { x: 75, y: 30 },
      existingCore: first.coreMask,
      existingSeeds: first.seeds,
      params: { tolerance: 30, feather: 0, expand: 0, smoothEdge: 0 },
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.regions.length).toBeGreaterThanOrEqual(1);

    const islands = smartResultIslands(merged);
    expect(islands.length).toBeGreaterThanOrEqual(2);
    const parts = createSmartCutoutFrameParts(merged, "Smart Cutout 1", { depth: 0 });
    expect(parts).toHaveLength(islands.length);
    for (const part of parts) {
      expect(part.points.length).toBeGreaterThanOrEqual(3);
      expect(parseSmartCutoutNotes(part.notes).meta?.regions ?? []).toEqual([]);
    }
    const holes = createSmartCutoutHoles(merged, "Cutout", 1);
    expect(holes).toHaveLength(islands.length);
  });

  it("folds expand/shrink/feather into a single border size control", () => {
    expect(detectBorderPx({ expand: 2, shrink: 0, feather: 1 })).toBe(3);
    expect(detectBorderPx({ expand: 0, shrink: 2, feather: 0 })).toBe(-2);
    const grown = withDetectBorderPx(
      { tolerance: 28, expand: 0, shrink: 0, feather: 1, smoothEdge: 1 },
      3,
    );
    expect(grown).toMatchObject({ expand: 3, shrink: 0, feather: 0 });
    expect(detectBorderPx(grown)).toBe(3);
    const shrunk = withDetectBorderPx(grown, -2);
    expect(shrunk).toMatchObject({ expand: 0, shrink: 2, feather: 0 });
    expect(detectBorderPx(shrunk)).toBe(-2);
  });
});
