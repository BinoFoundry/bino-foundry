import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { WristSizeCreateDTO, WristSizeUpdateDTO } from "./wrist-size.validation.js";

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    sizeCm: Number(row.size_cm),
    label: row.label,
    notes: row.notes ?? null,
    displayOrder: row.display_order,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function clearOtherDefaults(exceptId?: string) {
  const supabase = getSupabaseServiceRole();
  let q = supabase.from("wrist_sizes").update({ is_default: false }).eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  assertNoDbError(error);
}

export class WristSizeService {
  async list(activeOnly = false) {
    const supabase = getSupabaseServiceRole();
    let q = supabase.from("wrist_sizes").select("*").order("display_order").order("size_cm");
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async get(id: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("wrist_sizes").select("*").eq("id", id).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Wrist size not found");
    return mapRow(data as Record<string, unknown>);
  }

  async create(dto: WristSizeCreateDTO) {
    const supabase = getSupabaseServiceRole();
    if (dto.isDefault) await clearOtherDefaults();

    const { data, error } = await supabase
      .from("wrist_sizes")
      .insert({
        size_cm: dto.sizeCm,
        label: dto.label.trim(),
        notes: dto.notes?.trim() || null,
        display_order: dto.displayOrder ?? 0,
        is_active: dto.isActive ?? true,
        is_default: dto.isDefault ?? false,
      })
      .select("*")
      .single();

    if (error?.code === "23505") throw new ConflictError("Wrist size cm already exists");
    assertNoDbError(error);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, dto: WristSizeUpdateDTO) {
    const supabase = getSupabaseServiceRole();
    if (dto.isDefault) await clearOtherDefaults(id);

    const patch: Record<string, unknown> = {};
    if (dto.sizeCm !== undefined) patch.size_cm = dto.sizeCm;
    if (dto.label !== undefined) patch.label = dto.label.trim();
    if (dto.notes !== undefined) patch.notes = dto.notes?.trim() || null;
    if (dto.displayOrder !== undefined) patch.display_order = dto.displayOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.isDefault !== undefined) patch.is_default = dto.isDefault;

    const { data, error } = await supabase.from("wrist_sizes").update(patch).eq("id", id).select("*").single();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Wrist size not found");
    return mapRow(data as Record<string, unknown>);
  }

  async remove(id: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("wrist_sizes").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Wrist size deleted" };
  }
}

export const wristSizeService = new WristSizeService();
