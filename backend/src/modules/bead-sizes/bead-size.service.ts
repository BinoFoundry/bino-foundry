import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { BeadSizeCreateDTO, BeadSizeUpdateDTO } from "./bead-size.validation.js";

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    sizeMm: Number(row.size_mm),
    label: row.label,
    priceMultiplier: Number(row.price_multiplier),
    displayOrder: row.display_order,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function clearOtherDefaults(exceptId?: string) {
  const supabase = getSupabaseServiceRole();
  let q = supabase.from("bead_sizes").update({ is_default: false }).eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  assertNoDbError(error);
}

export class BeadSizeService {
  async list(activeOnly = false) {
    const supabase = getSupabaseServiceRole();
    let q = supabase.from("bead_sizes").select("*").order("display_order").order("size_mm");
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async get(id: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("bead_sizes").select("*").eq("id", id).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead size not found");
    return mapRow(data as Record<string, unknown>);
  }

  async create(dto: BeadSizeCreateDTO) {
    const supabase = getSupabaseServiceRole();
    if (dto.isDefault) await clearOtherDefaults();

    const { data, error } = await supabase
      .from("bead_sizes")
      .insert({
        size_mm: dto.sizeMm,
        label: dto.label.trim(),
        price_multiplier: dto.priceMultiplier,
        display_order: dto.displayOrder ?? 0,
        is_active: dto.isActive ?? true,
        is_default: dto.isDefault ?? false,
      })
      .select("*")
      .single();

    if (error?.code === "23505") throw new ConflictError("Bead size mm already exists");
    assertNoDbError(error);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, dto: BeadSizeUpdateDTO) {
    const supabase = getSupabaseServiceRole();
    if (dto.isDefault) await clearOtherDefaults(id);

    const patch: Record<string, unknown> = {};
    if (dto.sizeMm !== undefined) patch.size_mm = dto.sizeMm;
    if (dto.label !== undefined) patch.label = dto.label.trim();
    if (dto.priceMultiplier !== undefined) patch.price_multiplier = dto.priceMultiplier;
    if (dto.displayOrder !== undefined) patch.display_order = dto.displayOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.isDefault !== undefined) patch.is_default = dto.isDefault;

    const { data, error } = await supabase.from("bead_sizes").update(patch).eq("id", id).select("*").single();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead size not found");
    return mapRow(data as Record<string, unknown>);
  }

  async remove(id: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("bead_sizes").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Bead size deleted" };
  }
}

export const beadSizeService = new BeadSizeService();
