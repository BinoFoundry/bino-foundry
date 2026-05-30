import type { FrameRenderView } from "@/types/frame-rendering";
import type { MaskConfig } from "@/render/mask/mask-types";

/** Payload shape accepted by `PUT/POST /api/frames` renderViews. */
export function serializeRenderViewsForApi(views: FrameRenderView[]): Array<{
  view: FrameRenderView["view"];
  plateUrl: string;
  width: number;
  height: number;
  clipConfig: FrameRenderView["clipConfig"];
  clipStatus: FrameRenderView["clipStatus"];
  maskConfig: MaskConfig | null;
  maskStatus: FrameRenderView["maskStatus"];
}> {
  return views
    .filter((v) => Boolean(v.plateUrl?.trim()))
    .map((v) => ({
      view: v.view,
      plateUrl: v.plateUrl.trim(),
      width: Math.max(1, Math.floor(Number(v.width) || 0)),
      height: Math.max(1, Math.floor(Number(v.height) || 0)),
      clipConfig: v.clipConfig ?? null,
      clipStatus: v.clipStatus ?? (v.clipConfig ? "ready" : "draft"),
      maskConfig: v.maskConfig ?? null,
      maskStatus: v.maskStatus ?? v.clipStatus ?? "draft",
    }));
}
