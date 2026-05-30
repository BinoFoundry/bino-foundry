import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { UpsertFrameViewDTO } from "./rendering.validation.js";

export type FrameViewAxis = "front" | "side" | "three_quarter";

export interface FrameRenderViewRow {
  id: string;
  frameId: string;
  view: FrameViewAxis;
  plateUrl: string;
  width: number;
  height: number;
  clipConfig: unknown | null;
  clipStatus: "draft" | "ready";
  maskConfig: unknown | null;
  maskStatus: "draft" | "ready";
}

function isClipConfigValid(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const c = config as { version?: number; lenses?: unknown[] };
  if (c.version !== 1) return false;
  if (!Array.isArray(c.lenses) || c.lenses.length === 0) return false;
  return c.lenses.some((l) => {
    const pathD = (l as { pathD?: string }).pathD;
    return typeof pathD === "string" && pathD.trim().length > 8;
  });
}

function mapViewRow(row: Record<string, unknown>): FrameRenderViewRow {
  return {
    id: String(row.id),
    frameId: String(row.frame_id),
    view: row.view_axis as FrameViewAxis,
    plateUrl: String(row.plate_url),
    width: Number(row.image_width),
    height: Number(row.image_height),
    clipConfig: row.clip_config ?? null,
    clipStatus: (row.clip_status as "draft" | "ready") ?? "draft",
    maskConfig: row.mask_config ?? null,
    maskStatus: (row.mask_status as "draft" | "ready") ?? "draft",
  };
}

export class RenderingService {
  private async assertFrameExists(frameId: string): Promise<void> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("frames").select("id").eq("id", frameId).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Frame not found");
  }

  async getBundle(frameId: string): Promise<{ frameId: string; views: FrameRenderViewRow[] }> {
    await this.assertFrameExists(frameId);
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("frame_render_views")
      .select("*")
      .eq("frame_id", frameId)
      .order("view_axis", { ascending: true });

    assertNoDbError(error);
    return {
      frameId,
      views: (data ?? []).map((row) => mapViewRow(row as Record<string, unknown>)),
    };
  }

  async upsertView(
    frameId: string,
    viewAxis: FrameViewAxis,
    payload: UpsertFrameViewDTO,
  ): Promise<FrameRenderViewRow> {
    await this.assertFrameExists(frameId);

    let clipStatus = payload.clipStatus ?? "draft";
    if (payload.clipConfig) {
      if (!isClipConfigValid(payload.clipConfig)) {
        throw new ValidationError("clipConfig must include at least one lens with a valid SVG path");
      }
      clipStatus = payload.clipStatus ?? "ready";
    }

    const supabase = getSupabaseServiceRole();
    const row = {
      frame_id: frameId,
      view_axis: viewAxis,
      plate_url: payload.plateUrl,
      image_width: payload.imageWidth,
      image_height: payload.imageHeight,
      clip_config: payload.clipConfig ?? null,
      clip_status: clipStatus,
      mask_config: payload.maskConfig ?? null,
      mask_status: payload.maskStatus ?? clipStatus,
    };

    const { data, error } = await supabase
      .from("frame_render_views")
      .upsert(row, { onConflict: "frame_id,view_axis" })
      .select("*")
      .single();

    assertNoDbError(error);
    return mapViewRow(data as Record<string, unknown>);
  }

  async removeView(frameId: string, viewAxis: FrameViewAxis): Promise<{ message: string }> {
    await this.assertFrameExists(frameId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase
      .from("frame_render_views")
      .delete()
      .eq("frame_id", frameId)
      .eq("view_axis", viewAxis);

    assertNoDbError(error);
    return { message: "View removed" };
  }
}
