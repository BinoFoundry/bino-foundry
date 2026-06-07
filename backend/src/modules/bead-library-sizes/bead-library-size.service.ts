import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { SyncLibrarySizesDTO } from "./bead-library-size.validation.js";

function mapRow(row: Record<string, unknown>) {
  const lib = row.bead_libraries as { public_id?: string } | null | undefined;
  const size = row.bead_sizes as { id?: string; size_mm?: number; label?: string; display_order?: number } | null;
  const sizeMm = Number(size?.size_mm ?? row.size_mm ?? 0);
  const libraryPublicId = lib?.public_id ?? "";
  return {
    id: row.id,
    beadLibraryId: libraryPublicId,
    beadLibraryUuid: row.bead_library_id,
    beadSizeId: size?.id ?? row.bead_size_id,
    sizeMm,
    label: size?.label ?? `${sizeMm} mm`,
    unitPrice: Number(row.unit_price),
    currencyCode: row.currency_code,
    displayOrder: size?.display_order ?? 0,
    isDefault: row.is_default === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    /** Stable client key (library public id + mm). */
    offerKey: libraryPublicId ? `${libraryPublicId}-${sizeMm}` : "",
  };
}

const SELECT =
  "*, bead_libraries(public_id, name, bead_types(slug)), bead_sizes(size_mm, label, display_order, is_active)";

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
    .from("bead_library_sizes")
    .update({ is_default: false })
    .eq("bead_library_id", libraryUuid)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  assertNoDbError(error);
}

export class BeadLibrarySizeService {
  async list(options?: { libraryId?: string }) {
    const supabase = getSupabaseServiceRole();
    let q = supabase.from("bead_library_sizes").select(SELECT);
    if (options?.libraryId) {
      const libUuid = await resolveLibraryUuid(options.libraryId);
      q = q.eq("bead_library_id", libUuid);
    }
    const { data, error } = await q;
    assertNoDbError(error);
    return (data ?? [])
      .filter((row) => {
        const size = (row as Record<string, unknown>).bead_sizes as { is_active?: boolean } | null;
        return size?.is_active !== false;
      })
      .map((r) => mapRow(r as Record<string, unknown>));
  }

  async syncLibrarySizes(libraryId: string, dto: SyncLibrarySizesDTO) {
    const supabase = getSupabaseServiceRole();
    const libraryUuid = await resolveLibraryUuid(libraryId);

    const { data: libRow, error: libErr } = await supabase
      .from("bead_libraries")
      .select("id")
      .eq("id", libraryUuid)
      .maybeSingle();
    assertNoDbError(libErr);
    if (!libRow) throw new NotFoundError("Bead library not found");

    const { data: sizeRows, error: sizeErr } = await supabase
      .from("bead_sizes")
      .select("id, size_mm, is_active")
      .eq("is_active", true);
    assertNoDbError(sizeErr);

    const sizeByMm = new Map(
      (sizeRows ?? []).map((r) => {
        const row = r as { id: string; size_mm: number };
        return [Number(row.size_mm), row.id] as const;
      }),
    );

    const defaults = dto.sizes.filter((s) => s.isDefault);
    if (defaults.length > 1) {
      throw new ValidationError("Only one default size per bead is allowed");
    }

    const { error: delErr } = await supabase
      .from("bead_library_sizes")
      .delete()
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(delErr);

    if (!dto.sizes.length) return [];

    let defaultSet = false;
    const inserts = dto.sizes.map((s) => {
      const beadSizeId = sizeByMm.get(s.sizeMm);
      if (!beadSizeId) {
        throw new ValidationError(`Unknown or inactive bead size: ${s.sizeMm} mm`);
      }
      const isDefault = Boolean(s.isDefault && !defaultSet);
      if (isDefault) defaultSet = true;
      return {
        bead_library_id: libraryUuid,
        bead_size_id: beadSizeId,
        unit_price: s.unitPrice,
        is_default: isDefault,
      };
    });

    if (!defaultSet && inserts.length) inserts[0].is_default = true;

    if (inserts.some((i) => i.is_default)) {
      await clearOtherDefaults(libraryUuid);
    }

    const { data, error } = await supabase
      .from("bead_library_sizes")
      .insert(inserts)
      .select(SELECT);
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async resolveForConfiguration(
    items: { beadLibraryId: string; beadSizeMm: number }[],
  ): Promise<
    Map<
      string,
      { id: string; sizeMm: number; unitPrice: number; libraryUuid: string; libraryPublicId: string; label: string }
    >
  > {
    const supabase = getSupabaseServiceRole();
    const libraryPublicIds = [...new Set(items.map((i) => i.beadLibraryId))];
    const { data: libs, error: libErr } = await supabase
      .from("bead_libraries")
      .select("id, public_id")
      .in("public_id", libraryPublicIds);
    assertNoDbError(libErr);

    const libUuidByPublic = new Map(
      (libs ?? []).map((r) => {
        const row = r as { id: string; public_id: string };
        return [row.public_id, row.id] as const;
      }),
    );

    const libraryUuids = [...libUuidByPublic.values()];
    if (!libraryUuids.length) return new Map();

    const { data: rows, error } = await supabase
      .from("bead_library_sizes")
      .select(SELECT)
      .in("bead_library_id", libraryUuids);
    assertNoDbError(error);

    const map = new Map<
      string,
      { id: string; sizeMm: number; unitPrice: number; libraryUuid: string; libraryPublicId: string; label: string }
    >();

    for (const raw of rows ?? []) {
      const row = mapRow(raw as Record<string, unknown>);
      const libPublic = row.beadLibraryId;
      const key = `${libPublic}:${row.sizeMm}`;
      map.set(key, {
        id: String(row.id),
        sizeMm: row.sizeMm,
        unitPrice: row.unitPrice,
        libraryUuid: String(row.beadLibraryUuid),
        libraryPublicId: libPublic,
        label: row.label,
      });
    }
    return map;
  }
}

export const beadLibrarySizeService = new BeadLibrarySizeService();
