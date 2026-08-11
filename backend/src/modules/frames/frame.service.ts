import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { runBackgroundTask } from "../../lib/run-background-task.js";
import { settingsService } from "../settings/settings.service.js";
import { catalogAvailabilityStatusService } from "../bead-availability-statuses/bead-availability-status.service.js";
import { slugifyKebab } from "../../lib/slug.js";
import { collectFrameAssetUrls, deleteFrameAssetUrls } from "./frame-assets.js";
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

  const legacyImages = Array.isArray(images) ? images : [];
  const plateFallback = views
    .map((v) => (v && typeof v === "object" && "plateUrl" in v ? String((v as { plateUrl?: string }).plateUrl ?? "") : ""))
    .filter(Boolean);

  return {
    id: row.id,
    name: row.name,
    price: Number(row.base_price),
    description: row.description ?? "",
    isActive: row.is_active !== false,
    availabilityStatusCode: String(row.availability_status_code ?? "ACTIVE"),
    displayOrder: Number(row.display_order ?? 0),
    lensRenderPresetId: row.lens_render_preset_id ? String(row.lens_render_preset_id) : null,
    useLensRenderPreset: row.use_lens_render_preset !== false,
    modelFamily:
      typeof row.model_family === "string" && row.model_family.trim()
        ? row.model_family.trim()
        : null,
    frameImages: legacyImages.length ? legacyImages : plateFallback,
    lensColors: Array.isArray(lens) ? lens : [],
    renderViews: views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchRenderViewsForFrames(
  frameIds: string[],
  options?: { includeMaskConfig?: boolean; includeClipConfig?: boolean },
): Promise<Map<string, Record<string, unknown>[]>> {
  const map = new Map<string, Record<string, unknown>[]>();
  if (frameIds.length === 0) return map;

  const includeMask = options?.includeMaskConfig !== false;
  const includeClip = options?.includeClipConfig !== false;
  // List payloads omit heavy JSON (mask + optional clip). Admin / customiser reload detail as needed.
  const columns =
    includeMask && includeClip
      ? "*"
      : [
          "id",
          "frame_id",
          "view_axis",
          "plate_url",
          "image_width",
          "image_height",
          "original_plate_url",
          "original_image_width",
          "original_image_height",
          // plate_crop_config / clip / mask omitted from catalogue list — loaded on detail/bundle
          "clip_status",
          "mask_status",
          ...(includeClip ? ["clip_config"] : []),
          ...(includeMask ? ["mask_config"] : []),
        ].join(",");

  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("frame_render_views")
    .select(columns)
    .in("frame_id", frameIds)
    .order("view_axis", { ascending: true });

  assertNoDbError(error);
  // Dynamic `columns` makes the client infer GenericStringError — normalize via unknown.
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  for (const row of rows) {
    const fid = String(row.frame_id);
    const list = map.get(fid) ?? [];
    list.push(row);
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
      .select(
        "id,slug,name,base_price,currency_code,description,display_order,is_active,availability_status_code,lens_render_preset_id,use_lens_render_preset,model_family,created_at,updated_at",
      )
      .order("display_order", { ascending: false })
      .order("name", { ascending: true });

    assertNoDbError(error);
    const rows = (data ?? []) as Record<string, unknown>[];
    const viewMap = await fetchRenderViewsForFrames(
      rows.map((r) => String(r.id)),
      { includeMaskConfig: false, includeClipConfig: false },
    );
    return rows.map((row) => mapFrameRow(row, viewMap.get(String(row.id)) ?? []));
  }

  async getById(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    // Frame row + render views in parallel — cuts ~half the wait on cold PostgREST.
    const [frameResult, viewMap] = await Promise.all([
      supabase.from("frames").select("*").eq("id", recordId).maybeSingle(),
      fetchRenderViewsForFrames([recordId], {
        includeMaskConfig: true,
        includeClipConfig: true,
      }),
    ]);

    assertNoDbError(frameResult.error);
    if (!frameResult.data) throw new NotFoundError("Frame not found");
    const row = frameResult.data as Record<string, unknown>;
    const mc = normalizeMarketing(row.marketing_copy);
    if ("render_views" in mc) {
      delete mc.render_views;
      row.marketing_copy = mc;
    }
    return mapFrameRow(row, viewMap.get(recordId) ?? []);
  }

  async create(payload: FrameCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { currencyCode } = await settingsService.getGeneralSettings();
    const slug = await allocateFrameSlug(payload.name);
    const marketing_copy = normalizeMarketing({});
    marketing_copy.legacy_frame_images = payload.frameImages ?? [];
    marketing_copy.legacy_lens_colors = payload.lensColors ?? [];
    if (payload.renderViews?.length) marketing_copy.render_views = payload.renderViews;

    const availabilityStatusCode =
      payload.availabilityStatusCode ?? (payload.isActive === false ? "INACTIVE" : "ACTIVE");
    await catalogAvailabilityStatusService.getByCode(availabilityStatusCode);

    const insertRow = {
      slug,
      name: payload.name.trim(),
      base_price: payload.price,
      currency_code: currencyCode,
      description: payload.description?.trim() ?? "",
      marketing_copy,
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
      availability_status_code: availabilityStatusCode,
      ...(payload.lensRenderPresetId !== undefined && {
        lens_render_preset_id: payload.lensRenderPresetId,
      }),
      ...(payload.useLensRenderPreset !== undefined && {
        use_lens_render_preset: payload.useLensRenderPreset,
      }),
      ...(payload.modelFamily !== undefined && {
        model_family:
          payload.modelFamily == null || !String(payload.modelFamily).trim()
            ? null
            : String(payload.modelFamily).trim(),
      }),
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
      ...(payload.lensRenderPresetId !== undefined && {
        lens_render_preset_id: payload.lensRenderPresetId,
      }),
      ...(payload.useLensRenderPreset !== undefined && {
        use_lens_render_preset: payload.useLensRenderPreset,
      }),
      ...(payload.modelFamily !== undefined && {
        model_family:
          payload.modelFamily == null || !String(payload.modelFamily).trim()
            ? null
            : String(payload.modelFamily).trim(),
      }),
      marketing_copy: mc,
    };

    if (payload.isActive !== undefined && payload.availabilityStatusCode === undefined) {
      updates.availability_status_code = payload.isActive === false ? "INACTIVE" : "ACTIVE";
    }
    if (payload.availabilityStatusCode !== undefined) {
      await catalogAvailabilityStatusService.getByCode(payload.availabilityStatusCode);
      updates.availability_status_code = payload.availabilityStatusCode;
    }

    const { data, error } = await supabase.from("frames").update(updates).eq("id", recordId).select("*").single();

    assertNoDbError(error);
    if (payload.renderViews !== undefined) {
      await syncFrameRenderViews(recordId, payload.renderViews);
    }
    const viewMap = await fetchRenderViewsForFrames([recordId]);
    return mapFrameRow(data as Record<string, unknown>, viewMap.get(recordId) ?? []);
  }

  async countDesignReferences(recordId: string): Promise<{ designCount: number; itemCount: number }> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase
      .from("frames")
      .select("id")
      .eq("id", recordId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Frame not found");

    const { data: refs, error: refErr } = await supabase
      .from("sunglasses_configurations")
      .select("public_id")
      .eq("frame_id", recordId);
    assertNoDbError(refErr);

    const configurations = refs ?? [];
    return {
      designCount: configurations.length,
      itemCount: configurations.length,
    };
  }

  async remove(recordId: string, options?: { force?: boolean }): Promise<{ message: string }> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase
      .from("frames")
      .select("id, name, marketing_copy")
      .eq("id", recordId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Frame not found");

    const frameName = String((existing as { name?: string }).name ?? "This frame").trim() || "This frame";

    const { count: refCount, error: refErr } = await supabase
      .from("sunglasses_configurations")
      .select("id", { count: "exact", head: true })
      .eq("frame_id", recordId);
    assertNoDbError(refErr);

    if (!options?.force && (refCount ?? 0) > 0) {
      throw new ConflictError(
        `Cannot delete "${frameName}" — it is used in saved sunglasses designs. Use force delete to remove it from the catalogue while preserving saved designs as replaceable placeholders.`,
      );
    }

    const { data: renderViewRows, error: viewsErr } = await supabase
      .from("frame_render_views")
      .select("*")
      .eq("frame_id", recordId);
    assertNoDbError(viewsErr);

    if (options?.force) {
      const { error: snapshotErr } = await supabase
        .from("sunglasses_configurations")
        .update({ frame_id_snapshot: recordId })
        .eq("frame_id", recordId);
      assertNoDbError(snapshotErr);
    }

    const assetUrls = collectFrameAssetUrls(
      existing as Record<string, unknown>,
      (renderViewRows ?? []) as Record<string, unknown>[],
    );

    const { error: delErr } = await supabase.from("frames").delete().eq("id", recordId);
    assertNoDbError(delErr);

    if (assetUrls.length) {
      runBackgroundTask("frame-asset-cleanup", async () => {
        await deleteFrameAssetUrls(assetUrls);
      });
    }

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
