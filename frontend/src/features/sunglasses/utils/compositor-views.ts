import { isFrameViewClipReady } from "@/render/lens-clip";
import type { SunglassesCompositorConfig } from "@/render/types";
import { FRAME_VIEW_LABELS, type FrameViewAxis } from "@/types/frame-rendering";

/**
 * Callers pass `includeSide` to opt into the two-view (front + side) list.
 *
 * The customiser now shows front + side on both the frame step and the tint step,
 * because the side plates are real photographed tint images that hold up under
 * colour. Thumbnails and admin still call without `includeSide` for front-only.
 */
export const CUSTOMISER_VIEW_ORDER: FrameViewAxis[] = ["front"];
const CUSTOMISER_VIEW_ORDER_WITH_SIDE: FrameViewAxis[] = ["front", "side"];

export interface CustomiserDisplayView {
  axis: FrameViewAxis;
  label: string;
  aspectRatio: "16/10" | "video";
}

export function getCustomiserDisplayViews(
  config: SunglassesCompositorConfig,
  options?: { includeSide?: boolean },
): CustomiserDisplayView[] {
  const order = options?.includeSide ? CUSTOMISER_VIEW_ORDER_WITH_SIDE : CUSTOMISER_VIEW_ORDER;
  const clipViews = config.clipViews ?? config.maskedViews;
  if (!clipViews) {
    const base: CustomiserDisplayView[] = [
      { axis: "front", label: FRAME_VIEW_LABELS.front, aspectRatio: "16/10" },
      { axis: "side", label: FRAME_VIEW_LABELS.side, aspectRatio: "video" },
    ];
    return base.filter((v) => order.includes(v.axis));
  }

  return order.filter((axis) => {
    const view = clipViews[axis];
    return view && isFrameViewClipReady(view);
  }).map((axis) => ({
    axis,
    label: FRAME_VIEW_LABELS[axis],
    aspectRatio: axis === "front" ? "16/10" : "video",
  }));
}
