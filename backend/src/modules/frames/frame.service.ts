import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { settingsService } from "../settings/settings.service.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { FrameCreateDTO, FrameUpdateDTO } from "./frame.validation.js";

type MarketingCopy = Record<string, unknown>;
type ViewAxis = "front" | "side" | "three_quarter";

function normalizeMarketing(existing: unknown): MarketingCopy {
  if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...(existing as MarketingCopy) };
  }
  return {};
}

function mapRenderViewRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    view: row.view_axis,
    plateUrl: row.plate_url,
    width: Number(row.image_width),
    height: Number(row.image_height),
    originalPlateUrl: row.original_plate_url ?? null,
    originalWidth: row.original_image_width != null ? Number(row.original_image_width) : null,
    originalHeight: row.original_image_height != null ? Number(row.original_image_height) : null,
    plateCropConfig: row.plate_crop_config ?? null,
    clipConfig: row.clip_config ?? null,
    clipStatus: row.clip_status ?? row.mask_status ?? "draft",
    maskConfig: row.mask_config ?? null,
    maskStatus: row.mask_status ?? "draft",
  };
}

function mapFrameRow(
  row: Record<string, unknown>,
  renderViews: Record<string, unknown>[] = [],
): Record<string, unknown> {
  const mc = normalizeMarketing(row.marketing_copy);
  const images = mc.legacy_frame_images ?? mc.gallery_urls;
  const lens = mc.legacy_lens_colors ?? mc.lens_colors;
  const localViews = mc.render_views;

  const views =
    renderViews.length > 0
      ? renderViews.map(mapRenderViewRow)
      : Array.isArray(localViews)
        ? localViews
        : [];

  return {
    id: row.id,
    name: row.name,
    price: Number(row.base_price),
    description: row.description ?? "",
    isActive: row.is_active !== false,
    displayOrder: Number(row.display_order ?? 0),
    frameImages: Array.isArray(images) ? images : [],
    lensColors: Array.isArray(lens) ? lens : [],
    renderViews: views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchRenderViewsForFrames(frameIds: string[]): Promise<Map<string, Record<string, unknown>[]>> {
  const map = new Map<string, Record<string, unknown>[]>();
  if (frameIds.length === 0) return map;

  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("frame_render_views")
    .select("*")
    .in("frame_id", frameIds)
    .order("view_axis", { ascending: true });

  assertNoDbError(error);
  for (const row of data ?? []) {
    const fid = String((row as Record<string, unknown>).frame_id);
    const list = map.get(fid) ?? [];
    list.push(row as Record<string, unknown>);
    map.set(fid, list);
  }
  return map;
}

async function allocateFrameSlug(label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.from("frames").select("id").eq("slug", candidate).maybeSingle();

    assertNoDbError(error);
    if (!data) return candidate;
  }

  throw new Error("Unable to allocate unique frames.slug");
}

function normalizeRenderViews(
  renderViews: FrameCreateDTO["renderViews"] | FrameUpdateDTO["renderViews"],
): Array<{
  view: ViewAxis;
  plateUrl: string;
  width: number;
  height: number;
  originalPlateUrl: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  plateCropConfig: unknown | null;
  clipConfig: unknown | null;
  clipStatus: "draft" | "ready";
  maskConfig: unknown | null;
  maskStatus: "draft" | "ready";
}> {
  if (!renderViews?.length) return [];

  const dedup = new Map<ViewAxis, {
    view: ViewAxis;
    plateUrl: string;
    width: number;
    height: number;
    originalPlateUrl: string | null;
    originalWidth: number | null;
    originalHeight: number | null;
    plateCropConfig: unknown | null;
    clipConfig: unknown | null;
    clipStatus: "draft" | "ready";
    maskConfig: unknown | null;
    maskStatus: "draft" | "ready";
  }>();

  for (const v of renderViews) {
    if (v.view !== "front" && v.view !== "side" && v.view !== "three_quarter") continue;
    if (!v.plateUrl?.trim()) continue;
    if (!Number.isFinite(v.width) || v.width <= 0) continue;
    if (!Number.isFinite(v.height) || v.height <= 0) continue;

    dedup.set(v.view, {
      view: v.view,
      plateUrl: v.plateUrl.trim(),
      width: Math.floor(v.width),
      height: Math.floor(v.height),
      originalPlateUrl: v.originalPlateUrl?.trim() || null,
      originalWidth: v.originalWidth != null ? Math.floor(v.originalWidth) : null,
      originalHeight: v.originalHeight != null ? Math.floor(v.originalHeight) : null,
      plateCropConfig: v.plateCropConfig ?? null,
      clipConfig: v.clipConfig ?? null,
      clipStatus: v.clipStatus ?? "draft",
      maskConfig: v.maskConfig ?? null,
      maskStatus: v.maskStatus ?? v.clipStatus ?? "draft",
    });
  }

  return Array.from(dedup.values());
}

async function syncFrameRenderViews(
  frameId: string,
  renderViews: FrameCreateDTO["renderViews"] | FrameUpdateDTO["renderViews"],
): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const normalized = normalizeRenderViews(renderViews);
  const keepAxes = normalized.map((v) => v.view);

  if (keepAxes.length === 0) {
    const { error } = await supabase.from("frame_render_views").delete().eq("frame_id", frameId);
    assertNoDbError(error);
    return;
  }

  const upsertRows = normalized.map((v) => ({
    frame_id: frameId,
    view_axis: v.view,
    plate_url: v.plateUrl,
    image_width: v.width,
    image_height: v.height,
    original_plate_url: v.originalPlateUrl,
    original_image_width: v.originalWidth,
    original_image_height: v.originalHeight,
    plate_crop_config: v.plateCropConfig,
    clip_config: v.clipConfig,
    clip_status: v.clipStatus,
    mask_config: v.maskConfig,
    mask_status: v.maskStatus,
  }));

  const { error: upsertErr } = await supabase
    .from("frame_render_views")
    .upsert(upsertRows, { onConflict: "frame_id,view_axis" });
  assertNoDbError(upsertErr);

  if (keepAxes.length === 1) {
    const { error: cleanupErr } = await supabase
      .from("frame_render_views")
      .delete()
      .eq("frame_id", frameId)
      .neq("view_axis", keepAxes[0]);
    assertNoDbError(cleanupErr);
  }
}

export class FrameService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("frames")
      .select("*")
      .order("display_order", { ascending: false })
      .order("name", { ascending: true });

    assertNoDbError(error);
    const rows = (data ?? []) as Record<string, unknown>[];
    const viewMap = await fetchRenderViewsForFrames(rows.map((r) => String(r.id)));
    return rows.map((row) => mapFrameRow(row, viewMap.get(String(row.id)) ?? []));
  }

  async getById(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("frames").select("*").eq("id", recordId).maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Frame not found");
    const viewMap = await fetchRenderViewsForFrames([recordId]);
    return mapFrameRow(data as Record<string, unknown>, viewMap.get(recordId) ?? []);
  }

  async create(payload: FrameCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { currencyCode } = await settingsService.getGeneralSettings();
    const slug = await allocateFrameSlug(payload.name);
    const marketing_copy = normalizeMarketing({});
    marketing_copy.legacy_frame_images = payload.frameImages ?? [];
    marketing_copy.legacy_lens_colors = payload.lensColors ?? [];
    if (payload.renderViews?.length) marketing_copy.render_views = payload.renderViews;

    const insertRow = {
      slug,
      name: payload.name.trim(),
      base_price: payload.price,
      currency_code: currencyCode,
      description: payload.description?.trim() ?? "",
      marketing_copy,
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
    };

    const { data, error } = await supabase.from("frames").insert(insertRow).select("*").single();

    assertNoDbError(error);
    const frame = data as Record<string, unknown>;
    const frameId = String(frame.id);
    if (payload.renderViews !== undefined) {
      await syncFrameRenderViews(frameId, payload.renderViews);
    }
    const viewMap = await fetchRenderViewsForFrames([frameId]);
    return mapFrameRow(frame, viewMap.get(frameId) ?? []);
  }

  async update(recordId: string, payload: FrameUpdateDTO): Promise<unknown> {
    const existing = await this.rawFrame(recordId);

    const supabase = getSupabaseServiceRole();
    const mc = normalizeMarketing(existing.marketing_copy);
    if (payload.frameImages !== undefined) mc.legacy_frame_images = payload.frameImages;
    if (payload.lensColors !== undefined) mc.legacy_lens_colors = payload.lensColors;
    if (payload.renderViews !== undefined) mc.render_views = payload.renderViews;

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.price !== undefined && { base_price: payload.price }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.isActive !== undefined && { is_active: payload.isActive }),
      ...(payload.displayOrder !== undefined && { display_order: payload.displayOrder }),
      marketing_copy: mc,
    };

    const { data, error } = await supabase.from("frames").update(updates).eq("id", recordId).select("*").single();

    assertNoDbError(error);
    if (payload.renderViews !== undefined) {
      await syncFrameRenderViews(recordId, payload.renderViews);
    }
    const viewMap = await fetchRenderViewsForFrames([recordId]);
    return mapFrameRow(data as Record<string, unknown>, viewMap.get(recordId) ?? []);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.getById(recordId);

    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("frames").delete().eq("id", recordId);

    assertNoDbError(error);
    return { message: "Frame deleted successfully" };
  }

  private async rawFrame(recordId: string): Promise<Record<string, unknown>> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("frames").select("*").eq("id", recordId).maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Frame not found");
    return data as Record<string, unknown>;
  }
}

export const frameService = new FrameService();
