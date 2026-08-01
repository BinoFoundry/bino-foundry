import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { AdminDeferredNumberInput } from "./AdminDeferredNumberInput";
import { StrandRenderLivePreview } from "./StrandRenderLivePreview";

describe("AdminDeferredNumberInput", () => {
  it("exports a deferred numeric control", () => {
    expect(typeof AdminDeferredNumberInput).toBe("function");
  });
});

describe("StrandRenderLivePreview curved section", () => {
  it("exports the lightweight preview component", () => {
    expect(typeof StrandRenderLivePreview).toBe("function");
  });

  it("preserves negative vertical offsets in merge", () => {
    const merged = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
      verticalOffset: -0.2,
      hangOffset: -0.15,
    });
    expect(merged.verticalOffset).toBeCloseTo(-0.2);
    expect(merged.hangOffset).toBeCloseTo(-0.15);
  });

  it("clamps vertical offset after commit range", () => {
    const low = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, { verticalOffset: -2 });
    const high = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, { verticalOffset: 2 });
    expect(low.verticalOffset).toBe(-1);
    expect(high.verticalOffset).toBe(1);
  });
});
