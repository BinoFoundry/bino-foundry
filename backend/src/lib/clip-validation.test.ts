import { describe, expect, it } from "vitest";

import { clipValidationMessage, isClipConfigValid } from "./clip-validation.js";

describe("isClipConfigValid", () => {
  it("accepts version 1 clip with pathD", () => {
    expect(
      isClipConfigValid({
        version: 1,
        lenses: [{ id: "l1", label: "L", pathD: "M 10 10 L 20 20 Z" }],
      }),
    ).toBe(true);
  });

  it("rejects empty lenses", () => {
    expect(isClipConfigValid({ version: 1, lenses: [] })).toBe(false);
  });

  it("returns user-facing message when invalid", () => {
    expect(clipValidationMessage({ version: 2 })).toContain("clipConfig");
  });
});
