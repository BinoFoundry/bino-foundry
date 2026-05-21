import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { CharmTypeCreateDTO, CharmTypeUpdateDTO } from "./charm-type.validation.js";

function mapCharmTypeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allocateCharmTypeSlug(label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.from("charm_types").select("id").eq("slug", candidate).maybeSingle();
    assertNoDbError(error);
    if (!data) return candidate;
  }
  throw new Error("Unable to allocate unique charm_types.slug");
}

export class CharmTypeService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("charm_types")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    assertNoDbError(error);
    return (data ?? []).map((row) => mapCharmTypeRow(row as Record<string, unknown>));
  }

  async get(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("charm_types").select("*").eq("id", recordId).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Charm type not found");
    return mapCharmTypeRow(data as Record<string, unknown>);
  }

  async create(payload: CharmTypeCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const slug = await allocateCharmTypeSlug(payload.name);
    const { data, error } = await supabase
      .from("charm_types")
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
    return mapCharmTypeRow(data as Record<string, unknown>);
  }

  async update(recordId: string, payload: CharmTypeUpdateDTO): Promise<unknown> {
    await this.get(recordId);
    const supabase = getSupabaseServiceRole();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    const { data, error } = await supabase
      .from("charm_types")
      .update(updates)
      .eq("id", recordId)
      .select("*")
      .single();
    assertNoDbError(error);
    return mapCharmTypeRow(data as Record<string, unknown>);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.get(recordId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("charm_types").delete().eq("id", recordId);
    assertNoDbError(error);
    return { message: "Charm type removed" };
  }
}

export const charmTypeService = new CharmTypeService();
