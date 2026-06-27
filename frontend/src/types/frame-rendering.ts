import type { BeadCropConfig, LensClipConfig } from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask";

export type FrameViewAxis = "front" | "side" | "three_quarter";

export type FrameClipStatus = "draft" | "ready";

/** @deprecated Editor-only; persisted as clipConfig SVG paths. */
export type FrameMaskStatus = FrameClipStatus;

/** One photo plate + SVG lens clips for a view axis. */
export interface FrameRenderView {
  id?: string;
  view: FrameViewAxis;
  plateUrl: string;
  width: number;
  height: number;
  /** Untouched upload — preserved for reset / re-crop. */
  originalPlateUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  /** Path crop on original (BeadCropConfig v2) — persisted for re-edit; plateUrl holds processed export. */
  plateCropConfig?: BeadCropConfig | null;
  /** Primary persisted clip data (LensClipConfig v1). */
  clipConfig?: LensClipConfig | null;
  clipStatus?: FrameClipStatus;
  /** Legacy polygon editor state / migration source. */
  maskConfig?: MaskConfig | null;
  maskStatus?: FrameMaskStatus;
}

export interface FrameRenderBundle {
  frameId: string;
  views: FrameRenderView[];
}

export const FRAME_VIEW_AXES: FrameViewAxis[] = ["front", "side"];

export const FRAME_VIEW_LABELS: Record<FrameViewAxis, string> = {
  front: "Front view",
  side: "Side view",
  three_quarter: "45° view",
};
