import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { mmGroupNormalizationService } from "../bead-sizes/mm-group-normalization.service.js";
import type { SaveNormalizedExportsDTO, SyncLibrarySizesDTO } from "./bead-library-size.validation.js";

function mapRow(row: Record<string, unknown>) {
  const lib = row.bead_libraries as { public_id?: string } | null | undefined;
  const size = row.bead_sizes as {
    id?: string;
    size_mm?: number;
    label?: string;
    display_order?: number;
    group_reference_diameter_px?: number | null;
  } | null;
  const sizeMm = Number(size?.size_mm ?? row.size_mm ?? 0);
  const libraryPublicId = lib?.public_id ?? "";
  const norm = row.normalization_factor;
  const visible = row.asset_visible_diameter_px;
  const normalizedVisible = row.normalized_visible_diameter_px;
  const groupRef = size?.group_reference_diameter_px;
  const deliveryUrls = row.normalized_delivery_urls;
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
    normalizationFactor: norm != null && Number(norm) > 0 ? Number(norm) : 1,
    assetVisibleDiameterPx:
      visible != null && Number(visible) > 0 ? Number(visible) : null,
    groupReferenceDiameterPx:
      groupRef != null && Number(groupRef) > 0 ? Number(groupRef) : null,
    normalizedProcessedImageUrl:
      typeof row.normalized_processed_image_url === "string"
        ? row.normalized_processed_image_url
        : undefined,
    normalizedDeliveryUrls:
      deliveryUrls && typeof deliveryUrls === "object" ? deliveryUrls : undefined,
    normalizedVisibleDiameterPx:
      normalizedVisible != null && Number(normalizedVisible) > 0
        ? Number(normalizedVisible)
        : null,
    needsNormalizedReexport: row.needs_normalized_reexport === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    /** Stable client key (library public id + mm). */
    offerKey: libraryPublicId ? `${libraryPublicId}-${sizeMm}` : "",
  };
}

const SELECT =
  "*, bead_libraries(public_id, name, bead_types(slug)), bead_sizes(size_mm, label, display_order, is_active, group_reference_diameter_px)";

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

    const { data: existingRows, error: existingErr } = await supabase
      .from("bead_library_sizes")
      .select("id, bead_size_id, bead_sizes(size_mm, label)")
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(existingErr);

    if (!dto.sizes.length) {
      await this.deleteUnreferencedLibrarySizes(
        supabase,
        libraryUuid,
        (existingRows ?? []) as { id: string; bead_size_id: string; bead_sizes: { size_mm?: number; label?: string } | null }[],
      );
      return [];
    }

    let defaultSet = false;
    const desiredBeadSizeIds = new Set<string>();
    const upsertRows = dto.sizes.map((s) => {
      const beadSizeId = sizeByMm.get(s.sizeMm);
      if (!beadSizeId) {
        throw new ValidationError(`Unknown or inactive bead size: ${s.sizeMm} mm`);
      }
      desiredBeadSizeIds.add(beadSizeId);
      const isDefault = Boolean(s.isDefault && !defaultSet);
      if (isDefault) defaultSet = true;
      return {
        bead_library_id: libraryUuid,
        bead_size_id: beadSizeId,
        unit_price: s.unitPrice,
        is_default: isDefault,
      };
    });

    if (!defaultSet) upsertRows[0].is_default = true;

    const staleRows = ((existingRows ?? []) as {
      id: string;
      bead_size_id: string;
      bead_sizes: { size_mm?: number; label?: string } | null;
    }[]).filter((row) => !desiredBeadSizeIds.has(row.bead_size_id));

    await this.deleteUnreferencedLibrarySizes(supabase, libraryUuid, staleRows);

    await clearOtherDefaults(libraryUuid);

    const { data, error } = await supabase
      .from("bead_library_sizes")
      .upsert(upsertRows, { onConflict: "bead_library_id,bead_size_id" })
      .select(SELECT);
    assertNoDbError(error);
    await mmGroupNormalizationService.recalculateForLibrary(libraryId);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  private async deleteUnreferencedLibrarySizes(
    supabase: ReturnType<typeof getSupabaseServiceRole>,
    libraryUuid: string,
    rows: { id: string; bead_size_id: string; bead_sizes: { size_mm?: number; label?: string } | null }[],
  ) {
    if (!rows.length) return;

    const staleIds = rows.map((row) => row.id);
    const { data: refs, error: refsErr } = await supabase
      .from("bracelet_configuration_items")
      .select("bead_library_size_id")
      .in("bead_library_size_id", staleIds);
    assertNoDbError(refsErr);

    const referencedIds = new Set(
      (refs ?? [])
        .map((r) => (r as { bead_library_size_id?: string }).bead_library_size_id)
        .filter((id): id is string => Boolean(id)),
    );

    const blocked = rows.filter((row) => referencedIds.has(row.id));
    if (blocked.length) {
      const labels = blocked.map((row) => {
        const mm = row.bead_sizes?.size_mm;
        return row.bead_sizes?.label ?? (mm !== undefined ? `${mm} mm` : "a size");
      });
      throw new ValidationError(
        `Cannot remove ${labels.join(", ")} — used in saved bracelet designs. Unchecking a size only works when no saved designs reference it.`,
      );
    }

    const { error: delErr } = await supabase
      .from("bead_library_sizes")
      .delete()
      .eq("bead_library_id", libraryUuid)
      .in("id", staleIds);
    assertNoDbError(delErr);
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

  async saveNormalizedExports(libraryId: string, dto: SaveNormalizedExportsDTO) {
    const supabase = getSupabaseServiceRole();
    const libraryUuid = await resolveLibraryUuid(libraryId);

    const { data: junctionRows, error: junctionErr } = await supabase
      .from("bead_library_sizes")
      .select("id, bead_size_id, bead_sizes(size_mm)")
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(junctionErr);

    const junctionByMm = new Map(
      (junctionRows ?? []).map((r) => {
        const row = r as {
          id: string;
          bead_sizes: { size_mm?: number } | null;
        };
        return [Number(row.bead_sizes?.size_mm ?? 0), row.id] as const;
      }),
    );

    const updatedIds: string[] = [];

    for (const item of dto.exports) {
      const junctionId = junctionByMm.get(item.sizeMm);
      if (!junctionId) {
        throw new ValidationError(
          `Bead library is not enabled for size ${item.sizeMm} mm — enable the size before saving normalized exports.`,
        );
      }

      const { error: upErr } = await supabase
        .from("bead_library_sizes")
        .update({
          normalized_processed_image_url: item.normalizedProcessedImageUrl,
          normalized_delivery_urls: item.normalizedDeliveryUrls ?? null,
          normalized_visible_diameter_px: item.normalizedVisibleDiameterPx,
          needs_normalized_reexport: false,
        })
        .eq("id", junctionId);
      assertNoDbError(upErr);
      updatedIds.push(junctionId);
    }

    const { data, error } = await supabase
      .from("bead_library_sizes")
      .select(SELECT)
      .in("id", updatedIds);
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }
}

export const beadLibrarySizeService = new BeadLibrarySizeService();
