import type { CompositorView } from "@/render/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import type { FrameOption } from "@/lib/luxe-data";

export const NO_PREVIEW_MESSAGE: Record<CompositorView, string> = {
  front: "Front view preview unavailable",
  side: "Side view preview unavailable",
  three_quarter: "45° view preview unavailable",
};

export function getFrameRenderView(
  renderViews: FrameRenderView[] | undefined,
  view: CompositorView,
): FrameRenderView | undefined {
  const entry = renderViews?.find((v) => v.view === view);
  return entry?.plateUrl ? entry : undefined;
}

export function getFrontPlateUrl(frame: Pick<FrameOption, "renderViews" | "frameImages">): string | undefined {
  return getFrameRenderView(frame.renderViews, "front")?.plateUrl ?? frame.frameImages?.[0];
}
