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
  normalized_visible_diameter_px: number | null;
  bead_libraries: { crop_config: BeadCropConfig | null } | { crop_config: BeadCropConfig | null }[] | null;
};

/**
 * How many row updates to have in flight at once.
 *
 * PostgREST has no multi-row update with differing values, so each row needs
 * its own request. Sending them one after another made a full recalculation
 * take longer than the hosting gateway's 30s ceiling, which is a hard failure
 * rather than a slow success. Overlapping them keeps the wall time proportional
 * to the round trip rather than to the row count, and the cap keeps us well
 * inside Supabase's connection limits.
 */
const UPDATE_CONCURRENCY = 12;

/**
 * Groups are recalculated concurrently too. Each bead size owns a disjoint set
 * of junction rows, so they never contend; kept lower than the row concurrency
 * because every group fans out into row updates of its own.
 */
const GROUP_CONCURRENCY = 4;

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  }
  return results;
}

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

    const sizeIds = (sizes ?? []).map((r) => String((r as { id: string }).id));

    const results = await inBatches(sizeIds, GROUP_CONCURRENCY, (beadSizeId) =>
      this.recalculateGroup(beadSizeId),
    );

    return {
      groups: sizeIds.length,
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    };
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
      .select("id, bead_size_id, normalized_visible_diameter_px, bead_libraries(crop_config)")
      .eq("bead_size_id", beadSizeId);
    assertNoDbError(error);

    const entries: { junctionId: string; visibleDiameterPx: number; bakedDiameterPx: number }[] = [];
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
      entries.push({
        junctionId: row.id,
        visibleDiameterPx: visible,
        bakedDiameterPx: Number(row.normalized_visible_diameter_px ?? 0),
      });
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

    await inBatches(entries, UPDATE_CONCURRENCY, async (entry) => {
      const factor = computeMmGroupNormalizationFactor(groupReference, entry.visibleDiameterPx);
      const { error: upErr } = await supabase
        .from("bead_library_sizes")
        .update({
          normalization_factor: factor,
          asset_visible_diameter_px: entry.visibleDiameterPx,
        })
        .eq("id", entry.junctionId);
      assertNoDbError(upErr);
    });
    const updated = entries.length;

    // Same condition as before, decided from the values already in hand, and
    // applied to every affected row in a single request.
    const needsReexportIds = entries
      .filter(
        (e) =>
          referenceChanged || e.bakedDiameterPx <= 0 || Math.abs(e.bakedDiameterPx - groupReference) > 0.5,
      )
      .map((e) => e.junctionId);

    if (needsReexportIds.length) {
      const { error: flagErr } = await supabase
        .from("bead_library_sizes")
        .update({ needs_normalized_reexport: true })
        .in("id", needsReexportIds);
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
