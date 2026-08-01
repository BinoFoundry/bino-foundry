import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { AdminDeferredNumberInput } from "./AdminDeferredNumberInput";
import {
  buildCurvedPreview,
  StrandRenderLivePreview,
  STRAND_RENDER_PREVIEW_ANGLE_STEP,
} from "./StrandRenderLivePreview";

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

  it("keeps fixed angular spacing regardless of contactWidth (Builder parity)", () => {
    const narrow = buildCurvedPreview({ ...DEFAULT_STRAND_RENDER_PROFILE, contactWidth: 0.2 });
    const wide = buildCurvedPreview({ ...DEFAULT_STRAND_RENDER_PROFILE, contactWidth: 1.8 });
    expect(narrow.beads).toHaveLength(5);
    expect(wide.beads).toHaveLength(5);
    expect(narrow.beads[0]!.left).toBeCloseTo(wide.beads[0]!.left, 5);
    expect(narrow.beads[4]!.left).toBeCloseTo(wide.beads[4]!.left, 5);
    expect(STRAND_RENDER_PREVIEW_ANGLE_STEP).toBeGreaterThan(0);
  });

  it("applies visualScale to preview shell size like the Builder", () => {
    const base = buildCurvedPreview(DEFAULT_STRAND_RENDER_PROFILE);
    const scaled = buildCurvedPreview({ ...DEFAULT_STRAND_RENDER_PROFILE, visualScale: 1.25 });
    expect(scaled.beads[2]!.width / base.beads[2]!.width).toBeCloseTo(1.25, 5);
  });
});
