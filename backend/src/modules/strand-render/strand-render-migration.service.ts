import {
  beadLibraryInheritsTypeStrandDefaults,
  buildInitializedBeadTypeMetadata,
  inferStrandRenderDefaultsForType,
  isExperimentalSubTypeStrandBaseline,
  isReplaceableSubBeadTypeName,
  normalizeBeadLibraryStrandMetadata,
  normalizeSubBeadTypeStrandMetadata,
  parseStrandRenderProfile,
  recommendedSubTypeStrandBaseline,
  resolvedTypeStrandProfile,
  strandRenderStorageMeta,
  strandSubTypeClientCopy,
  typeNeedsStrandRenderInitialization,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { settingsService } from "../settings/settings.service.js";

export interface StrandRenderMigrationStats {
  typesInitialized: number;
  typesSkipped: number;
  typesKeysFilled: number;
  subTypesRepaired: number;
  subTypesSkipped: number;
  subTypeClientCopyEnriched: number;
  subTypeClientCopySkipped: number;
  librariesCleaned: number;
  librariesSkipped: number;
}

function typeRowMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const meta = row.metadata;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

async function resolvedTypeProfileForRow(
  row: Record<string, unknown>,
  systemDefaults: Awaited<ReturnType<typeof settingsService.getStrandRenderDefaults>>,
) {
  const metadata = typeRowMetadata(row);
  const typeDefaults = parseStrandRenderProfile(metadata.strandRender);
  return resolvedTypeStrandProfile(typeDefaults, systemDefaults);
}

export class StrandRenderMigrationService {
  /** Idempotent — only writes bead types missing metadata.strandRender. */
  async initializeMissingTypeDefaults(): Promise<Pick<StrandRenderMigrationStats, "typesInitialized" | "typesSkipped">> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("bead_types").select("id, slug, name, description, metadata");
    assertNoDbError(error);

    let typesInitialized = 0;
    let typesSkipped = 0;

    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      if (!typeNeedsStrandRenderInitialization(metadata)) {
        typesSkipped += 1;
        continue;
      }

      const nextMetadata = buildInitializedBeadTypeMetadata(
        {
          slug: String(typed.slug ?? ""),
          name: String(typed.name ?? ""),
          description: String(typed.description ?? ""),
          metadata,
        },
        metadata,
      );

      const { error: updateError } = await supabase
        .from("bead_types")
        .update({ metadata: nextMetadata })
        .eq("id", typed.id);

      assertNoDbError(updateError);
      typesInitialized += 1;
    }

    return { typesInitialized, typesSkipped };
  }

  /**
   * Fill missing keys on existing type strandRender from inferred baselines.
   * Existing keys always win — never overwrites tuned type values.
   */
  async fillMissingTypeStrandRenderKeys(): Promise<{ typesKeysFilled: number; typesSkipped: number }> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("bead_types").select("id, slug, name, description, metadata");
    assertNoDbError(error);

    let typesKeysFilled = 0;
    let typesSkipped = 0;

    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      const recommended = inferStrandRenderDefaultsForType({
        slug: String(typed.slug ?? ""),
        name: String(typed.name ?? ""),
        description: String(typed.description ?? ""),
        metadata,
      });
      const existing = parseStrandRenderProfile(metadata.strandRender) ?? {};
      let nextExisting = { ...existing };
      let changed = false;
      for (const [key, value] of Object.entries(recommended)) {
        if ((nextExisting as Record<string, unknown>)[key] === undefined) {
          (nextExisting as Record<string, unknown>)[key] = value;
          changed = true;
        }
      }
      // Legacy charm fraction 0.25 → neutral 0 (sub-types own hang offset).
      if (String(typed.slug ?? "") === "charm" && existing.verticalOffset === 0.25) {
        nextExisting.verticalOffset = 0;
        changed = true;
      }
      if (!changed) {
        typesSkipped += 1;
        continue;
      }

      const nextMetadata = {
        ...metadata,
        strandRender: { ...nextExisting, ...strandRenderStorageMeta() },
      };

      const { error: updateError } = await supabase
        .from("bead_types")
        .update({ metadata: nextMetadata })
        .eq("id", typed.id);
      assertNoDbError(updateError);
      typesKeysFilled += 1;
    }

    return { typesKeysFilled, typesSkipped };
  }

  /**
   * Replace only sub-type baselines that match known experimental fingerprints.
   * Never touches bead_libraries. Skips any sub-type the admin has since retuned.
   */
  async repairExperimentalSubTypeBaselines(): Promise<{
    subTypesRepaired: number;
    subTypesSkipped: number;
  }> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sub_bead_types")
      .select("id, slug, name, metadata");
    assertNoDbError(error);

    let subTypesRepaired = 0;
    let subTypesSkipped = 0;

    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const slug = String(typed.slug ?? "");
      const metadata = typeRowMetadata(typed);
      const override = parseStrandRenderProfile(metadata.strandRenderOverride);
      if (!isExperimentalSubTypeStrandBaseline(slug, override)) {
        subTypesSkipped += 1;
        continue;
      }

      const recommended = recommendedSubTypeStrandBaseline(slug);
      if (!recommended) {
        subTypesSkipped += 1;
        continue;
      }

      // crystal-general: prefer inheriting the (now complete) type baseline.
      if (slug === "crystal-general") {
        const nextMetadata = { ...metadata };
        delete nextMetadata.strandRenderOverride;
        nextMetadata.useBeadTypeStrandDefaults = true;
        const { error: updateError } = await supabase
          .from("sub_bead_types")
          .update({ metadata: nextMetadata })
          .eq("id", typed.id);
        assertNoDbError(updateError);
        subTypesRepaired += 1;
        continue;
      }

      const nextMetadata = normalizeSubBeadTypeStrandMetadata(
        {
          ...metadata,
          useBeadTypeStrandDefaults: false,
          strandRenderOverride: { ...recommended, ...strandRenderStorageMeta() },
        },
        // Inherited parent is unused for prune while explicitOptOut is true.
        inferStrandRenderDefaultsForType({ slug, name: String(typed.name ?? "") }),
      );

      const { error: updateError } = await supabase
        .from("sub_bead_types")
        .update({ metadata: nextMetadata })
        .eq("id", typed.id);
      assertNoDbError(updateError);
      subTypesRepaired += 1;
    }

    return { subTypesRepaired, subTypesSkipped };
  }

  /**
   * Enrich Charm hang sub-type display names + descriptions for clients.
   * Keeps slug/id; never overwrites custom names or meaningful descriptions.
   */
  async enrichCharmSubTypeClientCopy(): Promise<{
    subTypeClientCopyEnriched: number;
    subTypeClientCopySkipped: number;
  }> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("sub_bead_types").select("id, slug, name, description");
    assertNoDbError(error);

    let subTypeClientCopyEnriched = 0;
    let subTypeClientCopySkipped = 0;

    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const slug = String(typed.slug ?? "");
      const copy = strandSubTypeClientCopy(slug);
      if (!copy) {
        subTypeClientCopySkipped += 1;
        continue;
      }

      const name = String(typed.name ?? "");
      const description = String(typed.description ?? "");
      const nextName = isReplaceableSubBeadTypeName(slug, name) ? copy.suggestedName : name;
      const trimmedDesc = description.trim();
      const genericDesc =
        trimmedDesc.length === 0 ||
        ["default grouping for charm", slug, `${slug} charm`, "hanging charm", "drop charm", "fixed charm"].includes(
          trimmedDesc.toLowerCase(),
        );
      const nextDescription = genericDesc ? copy.description : description;

      if (nextName === name && nextDescription === description) {
        subTypeClientCopySkipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("sub_bead_types")
        .update({ name: nextName, description: nextDescription })
        .eq("id", typed.id);
      assertNoDbError(updateError);
      subTypeClientCopyEnriched += 1;
    }

    return { subTypeClientCopyEnriched, subTypeClientCopySkipped };
  }

  /** Remove redundant per-bead overrides; keep only values that differ from type defaults. */
  async cleanupRedundantLibraryOverrides(): Promise<
    Pick<StrandRenderMigrationStats, "librariesCleaned" | "librariesSkipped">
  > {
    const supabase = getSupabaseServiceRole();
    const systemDefaults = await settingsService.getStrandRenderDefaults();

    const { data: types, error: typesError } = await supabase
      .from("bead_types")
      .select("id, metadata");
    assertNoDbError(typesError);

    const typeProfileById = new Map<string, ReturnType<typeof resolvedTypeStrandProfile>>();
    for (const row of types ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      typeProfileById.set(
        String(typed.id),
        resolvedTypeStrandProfile(parseStrandRenderProfile(metadata.strandRender), systemDefaults),
      );
    }

    const { data: libraries, error: libError } = await supabase
      .from("bead_libraries")
      .select("id, bead_type_id, metadata");
    assertNoDbError(libError);

    let librariesCleaned = 0;
    let librariesSkipped = 0;

    for (const row of libraries ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      const hasOverride = metadata.strandRenderOverride != null;
      const inheritFlag = metadata.useTypeStrandDefaults === false;

      if (!hasOverride && !inheritFlag) {
        librariesSkipped += 1;
        continue;
      }

      const typeId = String(typed.bead_type_id ?? "");
      const inherited = typeProfileById.get(typeId) ?? systemDefaults;
      const normalized = normalizeBeadLibraryStrandMetadata(metadata, inherited);

      const changed = JSON.stringify(normalized) !== JSON.stringify(metadata);
      if (!changed) {
        librariesSkipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("bead_libraries")
        .update({ metadata: normalized })
        .eq("id", typed.id);

      assertNoDbError(updateError);
      librariesCleaned += 1;
    }

    return { librariesCleaned, librariesSkipped };
  }

  async runStartupMigration(): Promise<StrandRenderMigrationStats> {
    const types = await this.initializeMissingTypeDefaults();
    const typeKeys = await this.fillMissingTypeStrandRenderKeys();
    const subTypes = await this.repairExperimentalSubTypeBaselines();
    const clientCopy = await this.enrichCharmSubTypeClientCopy();
    const libraries = await this.cleanupRedundantLibraryOverrides();
    return {
      typesInitialized: types.typesInitialized,
      typesSkipped: types.typesSkipped + typeKeys.typesSkipped,
      typesKeysFilled: typeKeys.typesKeysFilled,
      subTypesRepaired: subTypes.subTypesRepaired,
      subTypesSkipped: subTypes.subTypesSkipped,
      ...clientCopy,
      ...libraries,
    };
  }

  async resetTypeToSystemDefaults(typeId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const systemDefaults = await settingsService.getStrandRenderDefaults();

    const { data, error } = await supabase
      .from("bead_types")
      .select("id, metadata")
      .eq("id", typeId)
      .maybeSingle();
    assertNoDbError(error);
    if (!data) throw new Error("Bead type not found");

    const metadata = typeRowMetadata(data as Record<string, unknown>);
    const nextMetadata = {
      ...metadata,
      strandRender: systemDefaults,
    };

    const { data: updated, error: updateError } = await supabase
      .from("bead_types")
      .update({ metadata: nextMetadata })
      .select("*")
      .single();
    assertNoDbError(updateError);
    return updated;
  }

  async applyTypeDefaultsToLibraries(typeId: string): Promise<{ updated: number }> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_libraries")
      .select("id, metadata")
      .eq("bead_type_id", typeId);
    assertNoDbError(error);

    let updated = 0;
    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      if (beadLibraryInheritsTypeStrandDefaults(metadata)) continue;

      const nextMetadata = { ...metadata };
      delete nextMetadata.strandRenderOverride;
      nextMetadata.useTypeStrandDefaults = true;

      const { error: updateError } = await supabase
        .from("bead_libraries")
        .update({ metadata: nextMetadata })
        .eq("id", typed.id);
      assertNoDbError(updateError);
      updated += 1;
    }

    return { updated };
  }

  async resetLibrariesToTypeDefaults(libraryIds?: string[]): Promise<{ updated: number }> {
    const supabase = getSupabaseServiceRole();
    let query = supabase.from("bead_libraries").select("id, metadata");
    if (libraryIds?.length) {
      query = query.in("id", libraryIds);
    }
    const { data, error } = await query;
    assertNoDbError(error);

    let updated = 0;
    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const metadata = typeRowMetadata(typed);
      if (beadLibraryInheritsTypeStrandDefaults(metadata)) continue;

      const nextMetadata = { ...metadata };
      delete nextMetadata.strandRenderOverride;
      nextMetadata.useTypeStrandDefaults = true;

      const { error: updateError } = await supabase
        .from("bead_libraries")
        .update({ metadata: nextMetadata })
        .eq("id", typed.id);
      assertNoDbError(updateError);
      updated += 1;
    }

    return { updated };
  }
}

export const strandRenderMigrationService = new StrandRenderMigrationService();

/** Ensure new bead types always persist strand defaults. */
export function metadataWithStrandRenderDefaults(
  slug: string,
  name: string,
  description: string,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return buildInitializedBeadTypeMetadata(
    { slug, name, description, metadata: metadata ?? {} },
    metadata ?? {},
  );
}

export function inferStrandRenderForNewType(
  slug: string,
  name: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  return inferStrandRenderDefaultsForType({ slug, name, description, metadata: metadata ?? {} });
}
