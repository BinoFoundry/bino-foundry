import type { MaskConfig } from "@/render/mask";

export type FrameViewAxis = "front" | "side";

export type FrameMaskStatus = "draft" | "ready";

/** One masked photo view (front or side/45°). */
export interface FrameRenderView {
  id?: string;
  view: FrameViewAxis;
  plateUrl: string;
  width: number;
  height: number;
  maskConfig: MaskConfig | null;
  maskStatus: FrameMaskStatus;
}

export interface FrameRenderBundle {
  frameId: string;
  views: FrameRenderView[];
}

export const FRAME_VIEW_AXES: FrameViewAxis[] = ["front", "side"];

export const FRAME_VIEW_LABELS: Record<FrameViewAxis, string> = {
  front: "Front view",
  side: "Side view (45°)",
};
