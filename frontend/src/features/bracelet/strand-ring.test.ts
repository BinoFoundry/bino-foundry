import { describe, expect, it } from "vitest";

import {
  computeWristRingRadiusPx,
  wristSizeBoundsFromCatalog,
} from "./strand-ring";

const BOUNDS = wristSizeBoundsFromCatalog([14, 15, 16, 17, 18, 19]);

describe("computeWristRingRadiusPx", () => {
  it("returns distinct radii for every cm in the catalogue range", () => {
    const center = 200;
    const extent = 40;
    const scale = 1;
    const radii = [14, 15, 16, 17, 18, 19].map((cm) =>
      computeWristRingRadiusPx(center, cm, scale, extent, BOUNDS),
    );
    const unique = new Set(radii.map((r) => r.toFixed(4)));
    expect(unique.size).toBe(6);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThan(radii[i - 1]!);
    }
  });

  it("scales with future admin-added sizes automatically", () => {
    const bounds = wristSizeBoundsFromCatalog([12, 14, 16, 20, 22]);
    const small = computeWristRingRadiusPx(200, 12, 1, 40, bounds);
    const large = computeWristRingRadiusPx(200, 22, 1, 40, bounds);
    expect(small).toBeLessThan(large);
  });
});
