import { isFrameViewClipReady } from "@/render/lens-clip";
import type { SunglassesCompositorConfig } from "@/render/types";
import { FRAME_VIEW_LABELS, type FrameViewAxis } from "@/types/frame-rendering";

export const CUSTOMISER_VIEW_ORDER: FrameViewAxis[] = ["front", "side", "three_quarter"];

export interface CustomiserDisplayView {
  axis: FrameViewAxis;
  label: string;
  aspectRatio: "16/10" | "video";
}

export function getCustomiserDisplayViews(
  config: SunglassesCompositorConfig,
): CustomiserDisplayView[] {
  const clipViews = config.clipViews ?? config.maskedViews;
  if (!clipViews) {
    return [
      { axis: "front", label: FRAME_VIEW_LABELS.front, aspectRatio: "16/10" },
      { axis: "side", label: FRAME_VIEW_LABELS.side, aspectRatio: "video" },
    ];
  }

  return CUSTOMISER_VIEW_ORDER.filter((axis) => {
    const view = clipViews[axis];
    return view && isFrameViewClipReady(view);
  }).map((axis) => ({
    axis,
    label: FRAME_VIEW_LABELS[axis],
    aspectRatio: axis === "front" ? "16/10" : "video",
  }));
}
