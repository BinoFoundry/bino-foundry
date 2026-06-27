import { describe, expect, it } from "vitest";

import { normalizedExportCanvasSidePx } from "./crop-path";

describe("normalized export canvas", () => {
  it("uses identical canvas side for all beads in a mm group", () => {
    const ref = 1080;
    const side = normalizedExportCanvasSidePx(ref);
    expect(normalizedExportCanvasSidePx(ref)).toBe(side);
    expect(side).toBeGreaterThan(ref);
    expect(side - ref).toBeLessThanOrEqual(Math.ceil(ref * 0.08) + 2);
  });
});
