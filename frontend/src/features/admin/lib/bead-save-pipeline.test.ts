import { describe, expect, it } from "vitest";

import {
  buildBeadSaveDiff,
  cropConfigSemanticallyEqual,
  librarySizesSemanticallyEqual,
} from "./bead-save-pipeline";

describe("bead save diff", () => {
  it("omits crop when only metadata changed", () => {
    const initial = {
      id: "a",
      name: "Amethyst",
      image: "",
      beadTypeId: "t1",
      description: "",
      cropConfig: { version: 2, imageWidth: 100, imageHeight: 100, originalUrl: "x", points: [], updatedAt: 1 },
    };
    const next = {
      ...initial,
      metadata: { useTypeStrandDefaults: true },
    };
    const diff = buildBeadSaveDiff(initial, next, [{ sizeMm: 8, unitPrice: 10 }], [
      { sizeMm: 8, unitPrice: 10 },
    ]);
    expect(diff.cropChanged).toBe(false);
    expect(diff.metadataChanged).toBe(true);
    expect(diff.libraryPayload.cropConfig).toBeUndefined();
    expect(diff.sizesChanged).toBe(false);
  });

  it("detects unchanged crop timestamps as equal", () => {
    const base = {
      version: 2 as const,
      imageWidth: 100,
      imageHeight: 100,
      originalUrl: "x",
      points: [{ x: 0.1, y: 0.1 }],
    };
    expect(
      cropConfigSemanticallyEqual(
        { ...base, updatedAt: 1 },
        { ...base, updatedAt: 99 },
      ),
    ).toBe(true);
  });

  it("detects size price changes", () => {
    expect(
      librarySizesSemanticallyEqual(
        [{ sizeMm: 8, unitPrice: 10 }],
        [{ sizeMm: 8, unitPrice: 12 }],
      ),
    ).toBe(false);
  });
});
