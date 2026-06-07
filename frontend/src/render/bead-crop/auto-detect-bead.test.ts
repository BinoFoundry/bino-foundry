import { describe, expect, it } from "vitest";

import { detectBeadOutlineFromRgba } from "./auto-detect-bead";

function makeRgba(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("detectBeadOutlineFromRgba", () => {
  it("detects a centered circle on white background", () => {
    const w = 200;
    const h = 200;
    const cx = 100;
    const cy = 100;
    const radius = 42;
    const data = makeRgba(w, h, (x, y) => {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      return inside ? [120, 60, 180, 255] : [255, 255, 255, 255];
    });

    const result = detectBeadOutlineFromRgba(data, w, h);
    expect(result.points.length).toBeGreaterThanOrEqual(8);
    expect(result.confidence).toBeGreaterThan(0.5);

    const norms = result.points.map((p) => ({ x: p.x * w, y: p.y * h }));
    const centroid = norms.reduce(
      (acc, p) => ({ x: acc.x + p.x / norms.length, y: acc.y + p.y / norms.length }),
      { x: 0, y: 0 },
    );
    expect(dist(centroid, { x: cx, y: cy })).toBeLessThan(12);

    for (const p of norms) {
      const r = dist(p, { x: cx, y: cy });
      expect(r).toBeGreaterThan(radius * 0.75);
      expect(r).toBeLessThan(radius * 1.2);
    }
  });

  it("uses alpha channel when PNG has transparency", () => {
    const w = 120;
    const h = 120;
    const data = makeRgba(w, h, (x, y) => {
      const inside = (x - 60) ** 2 + (y - 60) ** 2 <= 30 ** 2;
      return inside ? [40, 40, 40, 255] : [0, 0, 0, 0];
    });

    const result = detectBeadOutlineFromRgba(data, w, h);
    expect(result.points.length).toBeGreaterThanOrEqual(8);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("returns empty result for blank white image", () => {
    const w = 100;
    const h = 100;
    const data = makeRgba(w, h, () => [255, 255, 255, 255]);
    const result = detectBeadOutlineFromRgba(data, w, h);
    expect(result.points.length).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("keeps the largest bead when noise specks exist", () => {
    const w = 160;
    const h = 160;
    const data = makeRgba(w, h, (x, y) => {
      const main = (x - 80) ** 2 + (y - 80) ** 2 <= 35 ** 2;
      const speck = (x - 12) ** 2 + (y - 14) ** 2 <= 4;
      if (main) return [90, 30, 30, 255];
      if (speck) return [50, 50, 50, 255];
      return [250, 250, 250, 255];
    });

    const result = detectBeadOutlineFromRgba(data, w, h);
    expect(result.points.length).toBeGreaterThanOrEqual(8);
    const norms = result.points.map((p) => ({ x: p.x * w, y: p.y * h }));
    const centroid = norms.reduce(
      (acc, p) => ({ x: acc.x + p.x / norms.length, y: acc.y + p.y / norms.length }),
      { x: 0, y: 0 },
    );
    expect(dist(centroid, { x: 80, y: 80 })).toBeLessThan(15);
  });
});
