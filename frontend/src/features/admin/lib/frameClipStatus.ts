import type { FrameRenderView } from "@/types/frame-rendering";
import { isFrameViewClipReady } from "@/render/lens-clip";

export type FrameClipSummary = "ready" | "draft" | "missing";

export function summarizeFrameClipStatus(views?: FrameRenderView[]): FrameClipSummary {
  const withPlates = views?.filter((v) => v.plateUrl) ?? [];
  if (withPlates.length === 0) return "missing";
  if (withPlates.every((v) => isFrameViewClipReady(v))) return "ready";
  return "draft";
}

export const FRAME_CLIP_LABELS: Record<FrameClipSummary, string> = {
  ready: "Clips ready",
  draft: "Clips draft",
  missing: "No plates",
};
