import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { FrameCreateDTO, FrameUpdateDTO } from "./frame.validation.js";

type MarketingCopy = Record<string, unknown>;

function normalizeMarketing(existing: unknown): MarketingCopy {
  if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...(existing as MarketingCopy) };
  }
  return {};
}

function mapFrameRow(row: Record<string, unknown>): Record<string, unknown> {
  const mc = normalizeMarketing(row.marketing_copy);
  const images = mc.legacy_frame_images ?? mc.gallery_urls;
  const lens = mc.legacy_lens_colors ?? mc.lens_colors;

  return {
    id: row.id,
    name: row.name,
    price: Number(row.base_price),
    description: row.description ?? "",
    frameImages: Array.isArray(images) ? images : [],
    lensColors: Array.isArray(lens) ? lens : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export class FrameService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("frames")
      .select("*")
      .order("display_order", { ascending: false })
      .order("name", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapFrameRow(row as Record<string, unknown>));
  }

  async getById(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("frames").select("*").eq("id", recordId).maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Frame not found");
    return mapFrameRow(data as Record<string, unknown>);
  }

  async create(payload: FrameCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const slug = await allocateFrameSlug(payload.name);
    const marketing_copy = normalizeMarketing({});
    marketing_copy.legacy_frame_images = payload.frameImages ?? [];
    marketing_copy.legacy_lens_colors = payload.lensColors ?? [];

    const insertRow = {
      slug,
      name: payload.name.trim(),
      base_price: payload.price,
      currency_code: "USD",
      description: payload.description?.trim() ?? "",
      marketing_copy,
      display_order: 0,
      is_active: true,
    };

    const { data, error } = await supabase.from("frames").insert(insertRow).select("*").single();

    assertNoDbError(error);
    return mapFrameRow(data as Record<string, unknown>);
  }

  async update(recordId: string, payload: FrameUpdateDTO): Promise<unknown> {
    const existing = await this.rawFrame(recordId);

    const supabase = getSupabaseServiceRole();
    const mc = normalizeMarketing(existing.marketing_copy);
    if (payload.frameImages !== undefined) mc.legacy_frame_images = payload.frameImages;
    if (payload.lensColors !== undefined) mc.legacy_lens_colors = payload.lensColors;

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.price !== undefined && { base_price: payload.price }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      marketing_copy: mc,
    };

    const { data, error } = await supabase.from("frames").update(updates).eq("id", recordId).select("*").single();

    assertNoDbError(error);
    return mapFrameRow(data as Record<string, unknown>);
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
