import {
  beadLibraryInheritsTypeStrandDefaults,
  buildInitializedBeadTypeMetadata,
  inferStrandRenderDefaultsForType,
  normalizeBeadLibraryStrandMetadata,
  parseStrandRenderProfile,
  resolvedTypeStrandProfile,
  typeNeedsStrandRenderInitialization,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { settingsService } from "../settings/settings.service.js";

export interface StrandRenderMigrationStats {
  typesInitialized: number;
  typesSkipped: number;
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
    const libraries = await this.cleanupRedundantLibraryOverrides();
    return { ...types, ...libraries };
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
