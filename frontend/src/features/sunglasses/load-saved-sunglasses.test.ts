import { describe, expect, it } from "vitest";

import type { FrameOption } from "@/lib/luxe-data";

import { resolveLoadedSunglassesFrame } from "./load-saved-sunglasses";
import { isUnavailableFrame } from "./unavailable-frame";

const ACTIVE_FRAME: FrameOption = {
  id: "frame-1",
  name: "Aviator",
  description: "",
  price: 120,
  availabilityStatusCode: "ACTIVE",
};

describe("load saved sunglasses frame", () => {
  it("uses a placeholder when the saved frame was deleted", () => {
    const resolved = resolveLoadedSunglassesFrame({
      savedFrameId: "missing-frame",
      catalogIssue: "deleted",
      allFrames: [ACTIVE_FRAME],
    });

    expect(isUnavailableFrame(resolved.frame)).toBe(true);
    expect(resolved.hasCatalogIssue).toBe(true);
  });

  it("keeps an inactive frame visible in saved designs", () => {
    const inactive: FrameOption = {
      ...ACTIVE_FRAME,
      id: "frame-inactive",
      isActive: false,
      availabilityStatusCode: "INACTIVE",
    };
    const resolved = resolveLoadedSunglassesFrame({
      savedFrameId: inactive.id,
      catalogIssue: "unavailable",
      allFrames: [inactive],
    });

    expect(isUnavailableFrame(resolved.frame)).toBe(false);
    expect(resolved.hasCatalogIssue).toBe(true);
    expect(resolved.frame.id).toBe("frame-inactive");
  });
});
