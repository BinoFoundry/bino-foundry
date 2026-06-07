import { describe, expect, it } from "vitest";

import { mmToBasePx } from "./strand-bead";

describe("mmToBasePx integration", () => {
  const sf = 1;

  it("preserves ordering for common builder sizes", () => {
    const sizes = [0.5, 2.5, 4, 6, 8, 10, 12];
    const px = sizes.map((mm) => mmToBasePx(mm, sf));
    for (let i = 1; i < px.length; i++) {
      expect(px[i]).toBeGreaterThan(px[i - 1]);
    }
  });
});
