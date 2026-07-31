import { describe, expect, it } from "vitest";

import {
  resolveGlassBaseSource,
  resolveGlassCompositionOrder,
  resolveGlassDebugStage,
  shouldReplaceOriginalLens,
} from "./glass-composition";

describe("glass composition helpers", () => {
  it("defaults composition order to hybrid", () => {
    expect(resolveGlassCompositionOrder(undefined)).toBe("hybrid");
    expect(resolveGlassCompositionOrder({ glassCompositionOrder: "under-frame" })).toBe(
      "under-frame",
    );
    expect(resolveGlassCompositionOrder({ glassCompositionOrder: "over-surface" })).toBe(
      "over-surface",
    );
  });

  it("selects sheet when a URL is present unless canvas is forced", () => {
    expect(resolveGlassBaseSource({ glassSheetUrl: null, glassBaseSource: "canvas" })).toBe(
      "canvas",
    );
    expect(
      resolveGlassBaseSource({
        glassSheetUrl: "https://cdn.example/sheet.png",
        glassBaseSource: "canvas",
      }),
    ).toBe("canvas");
    expect(
      resolveGlassBaseSource({
        glassSheetUrl: "https://cdn.example/sheet.png",
        glassBaseSource: "sheet",
      }),
    ).toBe("sheet");
  });

  it("always replaces original lens when openings exist", () => {
    expect(shouldReplaceOriginalLens(0)).toBe(false);
    expect(shouldReplaceOriginalLens(1)).toBe(true);
  });

  it("defaults debug stage to full", () => {
    expect(resolveGlassDebugStage(undefined)).toBe("full");
    expect(resolveGlassDebugStage({ glassDebugStage: "glass-base" })).toBe("glass-base");
    expect(resolveGlassDebugStage({ glassDebugStage: "glass-tint" })).toBe("glass-tint");
  });
});
