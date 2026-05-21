import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { SpacerTypeCreateDTO, SpacerTypeUpdateDTO } from "./spacer-type.validation.js";

function mapSpacerTypeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allocateSpacerTypeSlug(label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.from("spacer_types").select("id").eq("slug", candidate).maybeSingle();
    assertNoDbError(error);
    if (!data) return candidate;
  }
  throw new Error("Unable to allocate unique spacer_types.slug");
}

export class SpacerTypeService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("spacer_types")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    assertNoDbError(error);
    return (data ?? []).map((row) => mapSpacerTypeRow(row as Record<string, unknown>));
  }

  async get(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("spacer_types").select("*").eq("id", recordId).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Spacer type not found");
    return mapSpacerTypeRow(data as Record<string, unknown>);
  }

  async create(payload: SpacerTypeCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const slug = await allocateSpacerTypeSlug(payload.name);
    const { data, error } = await supabase
      .from("spacer_types")
      .insert({
        slug,
        name: payload.name.trim(),
        description: payload.description?.trim() ?? "",
        display_order: 0,
        is_active: true,
      })
      .select("*")
      .single();
    assertNoDbError(error);
    return mapSpacerTypeRow(data as Record<string, unknown>);
  }

  async update(recordId: string, payload: SpacerTypeUpdateDTO): Promise<unknown> {
    await this.get(recordId);
    const supabase = getSupabaseServiceRole();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    const { data, error } = await supabase
      .from("spacer_types")
      .update(updates)
      .eq("id", recordId)
      .select("*")
      .single();
    assertNoDbError(error);
    return mapSpacerTypeRow(data as Record<string, unknown>);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.get(recordId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("spacer_types").delete().eq("id", recordId);
    assertNoDbError(error);
    return { message: "Spacer type removed" };
  }
}

export const spacerTypeService = new SpacerTypeService();
