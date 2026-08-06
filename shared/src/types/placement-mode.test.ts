import { describe, expect, it } from "vitest";

import {
  DEFAULT_BEAD_PLACEMENT_MODE,
  parseBeadPlacementMode,
} from "./strand-render-profile.js";

describe("parseBeadPlacementMode", () => {
  it("accepts known modes", () => {
    expect(parseBeadPlacementMode("replace")).toBe("replace");
    expect(parseBeadPlacementMode("insert_between")).toBe("insert_between");
  });

  it("defaults invalid or missing values to replace", () => {
    expect(parseBeadPlacementMode(undefined)).toBe(DEFAULT_BEAD_PLACEMENT_MODE);
    expect(parseBeadPlacementMode(null)).toBe("replace");
    expect(parseBeadPlacementMode("")).toBe("replace");
    expect(parseBeadPlacementMode("Charm")).toBe("replace");
    expect(parseBeadPlacementMode("insert")).toBe("replace");
  });
});
