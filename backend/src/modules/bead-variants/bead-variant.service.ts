import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { BeadVariantCreateDTO, BeadVariantUpdateDTO } from "./bead-variant.validation.js";

function mapRow(row: Record<string, unknown>) {
  const lib = row.bead_libraries as { public_id?: string } | null | undefined;
  return {
    id: row.id,
    publicId: row.public_id,
    beadLibraryId: lib?.public_id ?? row.bead_library_id,
    beadLibraryUuid: row.bead_library_id,
    sizeMm: Number(row.size_mm),
    unitPrice: Number(row.unit_price),
    currencyCode: row.currency_code,
    label: row.label,
    displayOrder: row.display_order,
    isActive: row.is_active !== false,
    isDefault: row.is_default === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveLibraryUuid(publicOrUuid: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const isUuid = /^[0-9a-f-]{36}$/i.test(publicOrUuid);
  const { data, error } = await supabase
    .from("bead_libraries")
    .select("id")
    .eq(isUuid ? "id" : "public_id", publicOrUuid)
    .maybeSingle();
  assertNoDbError(error);
  if (!data) throw new NotFoundError("Bead library not found");
  return String((data as { id: string }).id);
}

async function clearOtherDefaults(libraryUuid: string, exceptId?: string) {
  const supabase = getSupabaseServiceRole();
  let q = supabase
    .from("bead_variants")
    .update({ is_default: false })
    .eq("bead_library_id", libraryUuid)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  assertNoDbError(error);
}

export class BeadVariantService {
  async list(options?: { activeOnly?: boolean; libraryId?: string }) {
    const supabase = getSupabaseServiceRole();
    let q = supabase
      .from("bead_variants")
      .select("*, bead_libraries(public_id)")
      .order("display_order")
      .order("size_mm");
    if (options?.activeOnly) q = q.eq("is_active", true);
    if (options?.libraryId) {
      const libUuid = await resolveLibraryUuid(options.libraryId);
      q = q.eq("bead_library_id", libUuid);
    }
    const { data, error } = await q;
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async get(id: string) {
    const supabase = getSupabaseServiceRole();
    const isUuid = /^[0-9a-f-]{36}$/i.test(id);
    const { data, error } = await supabase
      .from("bead_variants")
      .select("*, bead_libraries(public_id)")
      .eq(isUuid ? "id" : "public_id", id)
      .maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead variant not found");
    return mapRow(data as Record<string, unknown>);
  }

  async create(dto: BeadVariantCreateDTO) {
    const supabase = getSupabaseServiceRole();
    const libraryUuid = await resolveLibraryUuid(dto.beadLibraryId);
    if (dto.isDefault) await clearOtherDefaults(libraryUuid);

    const { data, error } = await supabase
      .from("bead_variants")
      .insert({
        public_id: dto.publicId.trim(),
        bead_library_id: libraryUuid,
        size_mm: dto.sizeMm,
        unit_price: dto.unitPrice,
        label: dto.label.trim(),
        display_order: dto.displayOrder ?? 0,
        is_active: dto.isActive ?? true,
        is_default: dto.isDefault ?? false,
      })
      .select("*, bead_libraries(public_id)")
      .single();

    if (error?.code === "23505") throw new ConflictError("Variant public id or size already exists for this bead");
    assertNoDbError(error);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, dto: BeadVariantUpdateDTO) {
    const supabase = getSupabaseServiceRole();
    const existing = await this.get(id);
    const rowId = String(existing.id);
    if (dto.isDefault) await clearOtherDefaults(String(existing.beadLibraryUuid), rowId);

    const patch: Record<string, unknown> = {};
    if (dto.sizeMm !== undefined) patch.size_mm = dto.sizeMm;
    if (dto.unitPrice !== undefined) patch.unit_price = dto.unitPrice;
    if (dto.label !== undefined) patch.label = dto.label.trim();
    if (dto.displayOrder !== undefined) patch.display_order = dto.displayOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.isDefault !== undefined) patch.is_default = dto.isDefault;

    const { data, error } = await supabase
      .from("bead_variants")
      .update(patch)
      .eq("id", rowId)
      .select("*, bead_libraries(public_id)")
      .single();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead variant not found");
    return mapRow(data as Record<string, unknown>);
  }

  async remove(id: string) {
    const supabase = getSupabaseServiceRole();
    const existing = await this.get(id);
    const { error } = await supabase.from("bead_variants").delete().eq("id", String(existing.id));
    assertNoDbError(error);
    return { message: "Bead variant deleted" };
  }

  async resolveForConfiguration(
    variantPublicIds: string[],
  ): Promise<Map<string, { id: string; sizeMm: number; unitPrice: number; libraryUuid: string }>> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_variants")
      .select("id, public_id, size_mm, unit_price, bead_library_id, is_active")
      .in("public_id", variantPublicIds);
    assertNoDbError(error);
    const map = new Map<string, { id: string; sizeMm: number; unitPrice: number; libraryUuid: string }>();
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      map.set(String(r.public_id), {
        id: String(r.id),
        sizeMm: Number(r.size_mm),
        unitPrice: Number(r.unit_price),
        libraryUuid: String(r.bead_library_id),
      });
    }
    return map;
  }
}

export const beadVariantService = new BeadVariantService();
