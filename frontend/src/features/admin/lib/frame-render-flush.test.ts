import { describe, expect, it } from "vitest";

import { patchFrameRenderView } from "./frame-render-flush";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";

function blankViews(): FrameRenderView[] {
  return FRAME_VIEW_AXES.map((view) => ({
    view,
    plateUrl: "",
    width: 0,
    height: 0,
    clipConfig: null,
    clipStatus: "draft" as const,
    maskConfig: null,
    maskStatus: "draft" as const,
  }));
}

describe("patchFrameRenderView", () => {
  it("keeps plateUrl when a second patch only updates mask (upload → detect chain)", () => {
    const empty = blankViews();
    const afterUpload = patchFrameRenderView(empty, "front", {
      plateUrl: "https://cdn.example/front.jpg",
      originalPlateUrl: "https://cdn.example/front.jpg",
      width: 800,
      height: 400,
      originalWidth: 800,
      originalHeight: 400,
      plateCropConfig: null,
      maskConfig: null,
      clipConfig: null,
    });
    const afterDetect = patchFrameRenderView(afterUpload, "front", {
      maskConfig: { version: 1 } as never,
      maskStatus: "ready",
    });

    const front = afterDetect.find((v) => v.view === "front")!;
    expect(front.plateUrl).toBe("https://cdn.example/front.jpg");
    expect(front.originalPlateUrl).toBe("https://cdn.example/front.jpg");
    expect(front.width).toBe(800);
    expect(front.maskStatus).toBe("ready");
  });

  it("works the same for side view", () => {
    const afterUpload = patchFrameRenderView(blankViews(), "side", {
      plateUrl: "https://cdn.example/side.jpg",
      originalPlateUrl: "https://cdn.example/side.jpg",
      width: 600,
      height: 300,
    });
    const afterDetect = patchFrameRenderView(afterUpload, "side", {
      maskStatus: "draft",
    });
    const side = afterDetect.find((v) => v.view === "side")!;
    expect(side.plateUrl).toBe("https://cdn.example/side.jpg");
    expect(side.originalPlateUrl).toBe("https://cdn.example/side.jpg");
  });
});
