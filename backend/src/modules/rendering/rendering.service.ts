import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { UpsertFrameViewDTO } from "./rendering.validation.js";

export interface FrameRenderViewRow {
  id: string;
  frameId: string;
  view: "front" | "side";
  plateUrl: string;
  width: number;
  height: number;
  maskConfig: unknown | null;
  maskStatus: "draft" | "ready";
}

function mapViewRow(row: Record<string, unknown>): FrameRenderViewRow {
  return {
    id: String(row.id),
    frameId: String(row.frame_id),
    view: row.view_axis as "front" | "side",
    plateUrl: String(row.plate_url),
    width: Number(row.image_width),
    height: Number(row.image_height),
    maskConfig: row.mask_config ?? null,
    maskStatus: (row.mask_status as "draft" | "ready") ?? "draft",
  };
}

function isMaskConfigValid(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const lenses = (config as { lenses?: unknown }).lenses;
  if (!Array.isArray(lenses)) return false;
  return lenses.some((l) => {
    const pts = (l as { points?: unknown[] }).points;
    return Array.isArray(pts) && pts.length >= 3;
  });
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
    viewAxis: "front" | "side",
    payload: UpsertFrameViewDTO,
  ): Promise<FrameRenderViewRow> {
    await this.assertFrameExists(frameId);

    let maskStatus = payload.maskStatus ?? "draft";
    if (payload.maskConfig) {
      if (!isMaskConfigValid(payload.maskConfig)) {
        throw new ValidationError("maskConfig must include at least one lens with 3+ points");
      }
      maskStatus = payload.maskStatus ?? "ready";
    }

    const supabase = getSupabaseServiceRole();
    const row = {
      frame_id: frameId,
      view_axis: viewAxis,
      plate_url: payload.plateUrl,
      image_width: payload.imageWidth,
      image_height: payload.imageHeight,
      mask_config: payload.maskConfig ?? null,
      mask_status: maskStatus,
    };

    const { data, error } = await supabase
      .from("frame_render_views")
      .upsert(row, { onConflict: "frame_id,view_axis" })
      .select("*")
      .single();

    assertNoDbError(error);
    return mapViewRow(data as Record<string, unknown>);
  }

  async removeView(frameId: string, viewAxis: "front" | "side"): Promise<{ message: string }> {
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
