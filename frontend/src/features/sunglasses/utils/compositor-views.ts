import { isFrameViewClipReady } from "@/render/lens-clip";
import type { SunglassesCompositorConfig } from "@/render/types";
import { FRAME_VIEW_LABELS, type FrameViewAxis } from "@/types/frame-rendering";

/**
 * Only the front view is shown to customers.
 *
 * The side view is where the product photography is weakest — the near lens
 * sits in deep shadow and the far one is half hidden — and every attempt to
 * render lens tints convincingly on it has fallen short of the front. Rather
 * than show one good view next to one poor one, the side is withheld until the
 * source photographs improve. Admin keeps its own view list.
 */
export const CUSTOMISER_VIEW_ORDER: FrameViewAxis[] = ["front"];

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
