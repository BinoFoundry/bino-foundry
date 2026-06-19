import type { FrameRenderView } from "@/types/frame-rendering";
import { isFrameViewClipReady } from "@/render/lens-clip";
import { viewRequiresLensClip } from "@/render/frame-plate/crop";

export type FrameClipSummary = "ready" | "draft" | "missing";

export function summarizeFrameClipStatus(views?: FrameRenderView[]): FrameClipSummary {
  const front = views?.find((v) => v.view === "front");
  if (!front?.plateUrl) {
    const anyPlate = views?.some((v) => v.plateUrl);
    return anyPlate ? "draft" : "missing";
  }
  if (isFrameViewClipReady(front)) return "ready";
  return "draft";
}

export function isFrameViewSaveReady(view: FrameRenderView): boolean {
  if (!view.plateUrl?.trim()) return true;
  if (!viewRequiresLensClip(view)) return true;
  return isFrameViewClipReady(view);
}

export const FRAME_CLIP_LABELS: Record<FrameClipSummary, string> = {
  ready: "Front clip ready",
  draft: "Front clip draft",
  missing: "No plates",
};

export function describeFrameSaveBlockers(views: FrameRenderView[]): string {
  const front = views.find((v) => v.view === "front");
  if (!front?.plateUrl?.trim()) return "";

  if (isFrameViewSaveReady(front)) return "";

  return "Complete the front view before saving: upload a photo, set the frame clip (Edit Frame), and define both lens paths (Edit Left Lens and Edit Right Lens).";
}
