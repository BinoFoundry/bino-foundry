import { describe, expect, it } from "vitest";

import { getCustomiserDisplayViews } from "@/features/sunglasses/utils/compositor-views";
import type { SunglassesCompositorConfig } from "@/render/types";

describe("getCustomiserDisplayViews", () => {
  it("returns only views with ready clips", () => {
    const config: SunglassesCompositorConfig = {
      renderMode: "svg-clip",
      basePrice: 100,
      tint: { name: "Test", top: "#000", bottom: "#111" },
      options: {},
      clipViews: {
        front: {
          view: "front",
          plateUrl: "https://example.com/f.jpg",
          width: 800,
          height: 600,
          clipStatus: "ready",
          clipConfig: {
            version: 1,
            imageWidth: 800,
            imageHeight: 600,
            lenses: [{ id: "l1", label: "Left", pathD: "M0 0 L800 0 L800 600 Z" }],
          },
        },
        side: {
          view: "side",
          plateUrl: "",
          width: 800,
          height: 600,
        },
      },
    };
    const views = getCustomiserDisplayViews(config);
    expect(views).toHaveLength(1);
    expect(views[0]?.axis).toBe("front");
  });
});
