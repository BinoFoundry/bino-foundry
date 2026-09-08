import { describe, expect, it } from "vitest";

import { resolveLensClipRenderSettings } from "./clip-settings";

/**
 * A tint has to read as glass you can see through, not as paint over a plate.
 * That needs `backgroundVisibility` to survive resolution — it used to be pinned
 * to 0, so anything an administrator set was silently discarded.
 */
describe("backgroundVisibility", () => {
  it("keeps the value configured on the preset", () => {
    const resolved = resolveLensClipRenderSettings(null, { backgroundVisibility: 0.85 });
    expect(resolved.backgroundVisibility).toBe(0.85);
  });

  it("defaults to a fully opaque substrate", () => {
    expect(resolveLensClipRenderSettings(null, {}).backgroundVisibility).toBe(0);
  });

  it("clamps out-of-range values instead of dropping them", () => {
    expect(resolveLensClipRenderSettings(null, { backgroundVisibility: 4 }).backgroundVisibility).toBe(1);
    expect(resolveLensClipRenderSettings(null, { backgroundVisibility: -2 }).backgroundVisibility).toBe(0);
  });

  it("reads the value off the clip config when no override is given", () => {
    const resolved = resolveLensClipRenderSettings(
      { lenses: [], render: { backgroundVisibility: 0.5 } } as never,
      undefined,
    );
    expect(resolved.backgroundVisibility).toBe(0.5);
  });

  it("leaves environment transparency retired", () => {
    const resolved = resolveLensClipRenderSettings(null, { environmentTransparency: 0.9 });
    expect(resolved.environmentTransparency).toBe(0);
  });
});
