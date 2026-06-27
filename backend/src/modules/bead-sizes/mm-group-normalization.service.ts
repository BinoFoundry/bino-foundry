import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import {
  computeMmGroupNormalizationFactor,
  resolveBeadPhysicalMetrics,
  resolveBeadVisibleDiameterPx,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

type LibrarySizeRow = {
  id: string;
  bead_size_id: string;
  bead_libraries: { crop_config: BeadCropConfig | null } | { crop_config: BeadCropConfig | null }[] | null;
};

/** Visible diameter from stored crop metadata (includes anchor estimate when mask data missing). */
export function resolveAssetVisibleDiameterPx(cropConfig: unknown): number | null {
  const resolution = resolveBeadPhysicalMetrics(cropConfig as BeadCropConfig | null);
  if (!resolution) return null;
  const diameter = resolveBeadVisibleDiameterPx(resolution.metrics);
  return diameter > 0 ? diameter : null;
}

export class MmGroupNormalizationService {
  /** Recompute group references and per-library factors for every active bead size. */
  async recalculateAll(): Promise<{ groups: number; updated: number; skipped: number }> {
    const supabase = getSupabaseServiceRole();
    const { data: sizes, error } = await supabase.from("bead_sizes").select("id").eq("is_active", true);
    assertNoDbError(error);

    let updated = 0;
    let skipped = 0;
    const sizeIds = (sizes ?? []).map((r) => String((r as { id: string }).id));

    for (const beadSizeId of sizeIds) {
      const result = await this.recalculateGroup(beadSizeId);
      updated += result.updated;
      skipped += result.skipped;
    }

    return { groups: sizeIds.length, updated, skipped };
  }

  /** Recompute groups for bead sizes linked to a library (after crop or size sync). */
  async recalculateForLibrary(libraryPublicIdOrUuid: string): Promise<void> {
    const supabase = getSupabaseServiceRole();
    const isUuid = /^[0-9a-f-]{36}$/i.test(libraryPublicIdOrUuid);
    const { data: lib, error: libErr } = await supabase
      .from("bead_libraries")
      .select("id")
      .eq(isUuid ? "id" : "public_id", libraryPublicIdOrUuid)
      .maybeSingle();
    assertNoDbError(libErr);
    if (!lib) return;

    const libraryUuid = String((lib as { id: string }).id);
    const { data: rows, error } = await supabase
      .from("bead_library_sizes")
      .select("bead_size_id")
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(error);

    const sizeIds = [...new Set((rows ?? []).map((r) => String((r as { bead_size_id: string }).bead_size_id)))];
    await Promise.all(sizeIds.map((id) => this.recalculateGroup(id)));
  }

  async recalculateGroup(beadSizeId: string): Promise<{ updated: number; skipped: number; referenceChanged: boolean }> {
    const supabase = getSupabaseServiceRole();

    const { data: prevSizeRow, error: prevErr } = await supabase
      .from("bead_sizes")
      .select("group_reference_diameter_px")
      .eq("id", beadSizeId)
      .maybeSingle();
    assertNoDbError(prevErr);
    const previousReference = Number(
      (prevSizeRow as { group_reference_diameter_px?: number } | null)?.group_reference_diameter_px ?? 0,
    );

    const { data: rows, error } = await supabase
      .from("bead_library_sizes")
      .select("id, bead_size_id, bead_libraries(crop_config)")
      .eq("bead_size_id", beadSizeId);
    assertNoDbError(error);

    const entries: { junctionId: string; visibleDiameterPx: number }[] = [];
    let skipped = 0;

    for (const raw of rows ?? []) {
      const row = raw as unknown as LibrarySizeRow;
      const lib = row.bead_libraries;
      const cropConfig = lib && !Array.isArray(lib) ? lib.crop_config : null;
      const visible = resolveAssetVisibleDiameterPx(cropConfig);
      if (visible == null) {
        skipped += 1;
        continue;
      }
      entries.push({ junctionId: row.id, visibleDiameterPx: visible });
    }

    if (!entries.length) {
      await supabase
        .from("bead_sizes")
        .update({ group_reference_diameter_px: null })
        .eq("id", beadSizeId);
      return { updated: 0, skipped, referenceChanged: false };
    }

    const groupReference = Math.max(...entries.map((e) => e.visibleDiameterPx));
    const referenceChanged =
      previousReference <= 0 || Math.abs(groupReference - previousReference) > 0.5;

    const { error: refErr } = await supabase
      .from("bead_sizes")
      .update({ group_reference_diameter_px: groupReference })
      .eq("id", beadSizeId);
    assertNoDbError(refErr);

    let updated = 0;
    for (const entry of entries) {
      const factor = computeMmGroupNormalizationFactor(groupReference, entry.visibleDiameterPx);
      const { error: upErr } = await supabase
        .from("bead_library_sizes")
        .update({
          normalization_factor: factor,
          asset_visible_diameter_px: entry.visibleDiameterPx,
        })
        .eq("id", entry.junctionId);
      assertNoDbError(upErr);
      updated += 1;
    }

    for (const entry of entries) {
      const { data: junctionRow, error: junctionErr } = await supabase
        .from("bead_library_sizes")
        .select("normalized_visible_diameter_px")
        .eq("id", entry.junctionId)
        .maybeSingle();
      assertNoDbError(junctionErr);

      const baked = Number(
        (junctionRow as { normalized_visible_diameter_px?: number } | null)
          ?.normalized_visible_diameter_px ?? 0,
      );
      const needsReexport =
        referenceChanged || baked <= 0 || Math.abs(baked - groupReference) > 0.5;

      if (!needsReexport) continue;

      const { error: flagErr } = await supabase
        .from("bead_library_sizes")
        .update({ needs_normalized_reexport: true })
        .eq("id", entry.junctionId);
      assertNoDbError(flagErr);
    }

    return { updated, skipped, referenceChanged };
  }

  /** Libraries in a mm group that need save-time normalized export regeneration. */
  async listPendingNormalizedReexport(beadSizeId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_library_sizes")
      .select("id, bead_library_id, bead_libraries(public_id, name, crop_config, original_image_url)")
      .eq("bead_size_id", beadSizeId)
      .eq("needs_normalized_reexport", true);
    assertNoDbError(error);
    return data ?? [];
  }
}

export const mmGroupNormalizationService = new MmGroupNormalizationService();
