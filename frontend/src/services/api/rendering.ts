import type { FrameRenderBundle, FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import type { LensClipConfig } from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask/mask-types";

import { apiRequest } from "./client";

export interface UpsertFrameViewPayload {
  plateUrl: string;
  imageWidth: number;
  imageHeight: number;
  clipConfig?: LensClipConfig | null;
  clipStatus?: "draft" | "ready";
  maskConfig?: MaskConfig | null;
  maskStatus?: "draft" | "ready";
}

function mapView(row: Record<string, unknown>): FrameRenderView {
  return {
    id: row.id as string | undefined,
    view: row.view as FrameViewAxis,
    plateUrl: String(row.plateUrl),
    width: Number(row.width),
    height: Number(row.height),
    clipConfig: (row.clipConfig as LensClipConfig | null) ?? null,
    clipStatus: (row.clipStatus as "draft" | "ready") ?? "draft",
    maskConfig: (row.maskConfig as MaskConfig | null) ?? null,
    maskStatus: (row.maskStatus as "draft" | "ready") ?? "draft",
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiFrameId(id: string): boolean {
  return UUID_RE.test(id);
}

export const renderingApi = {
  getBundle(frameId: string): Promise<FrameRenderBundle> {
    return apiRequest<FrameRenderBundle>(`/rendering/frames/${frameId}/bundle`);
  },

  async upsertView(
    frameId: string,
    viewAxis: FrameViewAxis,
    payload: UpsertFrameViewPayload,
  ): Promise<FrameRenderView> {
    const row = await apiRequest<Record<string, unknown>>(
      `/rendering/frames/${frameId}/views/${viewAxis}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    return mapView({
      id: row.id,
      view: row.view,
      plateUrl: row.plateUrl,
      width: row.width,
      height: row.height,
      clipConfig: row.clipConfig,
      clipStatus: row.clipStatus,
      maskConfig: row.maskConfig,
      maskStatus: row.maskStatus,
    });
  },

  removeView(frameId: string, viewAxis: FrameViewAxis): Promise<{ message: string }> {
    return apiRequest(`/rendering/frames/${frameId}/views/${viewAxis}`, { method: "DELETE" });
  },
};
