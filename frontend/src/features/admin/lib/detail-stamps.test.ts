import { describe, expect, it, beforeEach } from "vitest";

import { createLensPolygon, createMaskConfig } from "@/render/mask";

import {
  applyDetailStampToMask,
  listDetailStamps,
  saveDetailStampFromMask,
} from "./detail-stamps";

describe("detail-stamps", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and lists stamps by model family", () => {
    const detail = createLensPolygon(
      "rivet",
      "Rivet",
      [
        { x: 0.4, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.45, y: 0.4, curved: false, handleIn: null, handleOut: null },
        { x: 0.42, y: 0.45, curved: false, handleIn: null, handleOut: null },
      ],
      { layerOrder: "front" },
    );
    const mask = createMaskConfig(100, 50, [], undefined, [detail]);
    const stamp = saveDetailStampFromMask("Aviator Classic", "Rivet set", mask);
    expect(stamp?.name).toBe("Rivet set");
    expect(listDetailStamps("Aviator Classic")).toHaveLength(1);
    expect(listDetailStamps("Other")).toHaveLength(0);
  });

  it("applies a stamp onto an existing mask", () => {
    const left = createLensPolygon("left", "Left", [
      { x: 0.1, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.3, y: 0.2, curved: false, handleIn: null, handleOut: null },
      { x: 0.2, y: 0.4, curved: false, handleIn: null, handleOut: null },
    ]);
    const mask = createMaskConfig(100, 50, [left], undefined, []);
    const stamp = {
      id: "s1",
      name: "Hardware",
      updatedAt: 1,
      parts: [
        createLensPolygon(
          "p1",
          "Screw",
          [
            { x: 0.5, y: 0.5, curved: false, handleIn: null, handleOut: null },
            { x: 0.55, y: 0.5, curved: false, handleIn: null, handleOut: null },
            { x: 0.52, y: 0.55, curved: false, handleIn: null, handleOut: null },
          ],
          { layerOrder: "front" },
        ),
      ],
    };
    const next = applyDetailStampToMask(mask, stamp);
    expect(next.lenses).toHaveLength(1);
    expect(next.frameExclusions).toHaveLength(1);
  });
});
