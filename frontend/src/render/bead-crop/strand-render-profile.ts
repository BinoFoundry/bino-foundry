import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  beadLibrariesStrandRenderStamp,
  beadLibraryInheritsTypeStrandDefaults,
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseBeadPlacementMode,
  parseStrandRenderProfile,
  resolveStrandRenderConfig,
  subBeadTypeInheritsBeadTypeStrandDefaults,
  subBeadTypesStrandRenderStamp,
  type ResolvedStrandRenderConfig,
  type StrandRenderProfile,
  type StrandRenderConfigSource,
  type StrandRenderProfileKey,
  STRAND_RENDER_PROFILE_KEYS,
} from "@bino-foundry/shared/types";

export type { ResolvedStrandRenderConfig, StrandRenderProfile };

export interface StrandRenderCatalogueContext {
  beadTypes?: BeadTypeEntry[];
  subBeadTypes?: SubBeadTypeEntry[];
  /**
   * Live catalogue libraries — preferred source for inherit flags + bead overrides.
   * Placed-strand snapshots can be stale after Admin saves.
   */
  beadLibraries?: BeadLibraryEntry[];
  /** Platform defaults from config_kv — loaded once with catalogue. */
  strandRenderDefaults?: StrandRenderProfile | null;
}

/**
 * Prefer live catalogue metadata (type/sub ids + strand overrides) over a placed snapshot.
 * Visual assets on the placed bead are left unchanged.
 * Skipped when the bead carries a frozen order-time strand profile.
 */
export function hydrateBeadLibraryForStrandRender(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): BeadLibraryEntry | null | undefined {
  if (!bead?.id || !catalogue?.beadLibraries?.length) return bead;
  if ((bead.metadata as { frozenStrandRenderProfile?: unknown } | undefined)?.frozenStrandRenderProfile) {
    return bead;
  }
  const live = catalogue.beadLibraries.find((entry) => entry.id === bead.id);
  if (!live) return bead;
  return {
    ...bead,
    beadTypeId: live.beadTypeId ?? bead.beadTypeId,
    beadTypeSlug: live.beadTypeSlug ?? bead.beadTypeSlug,
    subBeadTypeId: live.subBeadTypeId ?? bead.subBeadTypeId,
    metadata: live.metadata ?? bead.metadata,
  };
}

function beadTypeFor(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): BeadTypeEntry | null {
  if (!bead || !catalogue?.beadTypes?.length) return null;
  return (
    catalogue.beadTypes.find((t) => t.id === bead.beadTypeId) ??
    catalogue.beadTypes.find((t) => t.slug === bead.beadTypeSlug) ??
    null
  );
}

function subBeadTypeFor(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): SubBeadTypeEntry | null {
  if (!bead?.subBeadTypeId || !catalogue?.subBeadTypes?.length) return null;
  return catalogue.subBeadTypes.find((s) => s.id === bead.subBeadTypeId) ?? null;
}

function typeDefaultsFromEntry(type: BeadTypeEntry | null): Partial<StrandRenderProfile> | null {
  if (!type) return null;
  const meta = type.metadata as { strandRender?: unknown } | undefined;
  const fromMeta = parseStrandRenderProfile(meta?.strandRender);
  // Column is canonical — never infer from category names / slug.
  const placementMode = parseBeadPlacementMode(type.placementMode);
  return { ...(fromMeta ?? {}), placementMode };
}

function subTypeOverrideFromEntry(
  subType: SubBeadTypeEntry | null | undefined,
): Partial<StrandRenderProfile> | null {
  if (!subType) return null;
  const meta = subType.metadata as { strandRenderOverride?: unknown } | undefined;
  return parseStrandRenderProfile(meta?.strandRenderOverride);
}

function libraryOverrideFromEntry(
  bead: BeadLibraryEntry | null | undefined,
): Partial<StrandRenderProfile> | null {
  if (!bead) return null;
  const meta = bead.metadata as {
    strandRenderOverride?: unknown;
    useTypeStrandDefaults?: boolean;
  } | undefined;
  return parseStrandRenderProfile(meta?.strandRenderOverride);
}

function libraryInheritsSubTypeDefaults(bead: BeadLibraryEntry | null | undefined): boolean {
  return beadLibraryInheritsTypeStrandDefaults(bead?.metadata ?? null);
}

/** Resolve hierarchical config for one bead library entry. */
export function resolveStrandRenderConfigForBead(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): ResolvedStrandRenderConfig {
  const frozenRaw = (bead?.metadata as { frozenStrandRenderProfile?: unknown } | undefined)
    ?.frozenStrandRenderProfile;
  if (frozenRaw && typeof frozenRaw === "object") {
    const profile = mergeStrandRenderProfile(
      DEFAULT_STRAND_RENDER_PROFILE,
      frozenRaw as Partial<StrandRenderProfile>,
    );
    const provenance = Object.fromEntries(
      STRAND_RENDER_PROFILE_KEYS.map((key) => [key, "beadOverride" as StrandRenderConfigSource]),
    ) as Record<StrandRenderProfileKey, StrandRenderConfigSource>;
    return { ...profile, provenance, resolvedRenderScale: profile.visualScale };
  }

  const hydrated = hydrateBeadLibraryForStrandRender(bead, catalogue);
  const typeEntry = beadTypeFor(hydrated, catalogue);
  const subTypeEntry = subBeadTypeFor(hydrated, catalogue);

  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
    subBeadTypeOverride: subTypeOverrideFromEntry(subTypeEntry),
    inheritSubBeadTypeFromBeadType: subBeadTypeInheritsBeadTypeStrandDefaults(subTypeEntry?.metadata),
    beadOverride: libraryOverrideFromEntry(hydrated),
    inheritBeadFromSubBeadType: libraryInheritsSubTypeDefaults(hydrated),
  });
}

/** @deprecated Use resolveStrandRenderConfigForBead */
export function resolveStrandRenderProfile(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): StrandRenderProfile {
  return resolveStrandRenderConfigForBead(bead, catalogue);
}

/** Resolve by type id/slug when only type context is available (layout hints). */
export function resolveStrandRenderConfigForType(
  typeIdOrSlug: string | undefined,
  catalogue?: StrandRenderCatalogueContext,
): ResolvedStrandRenderConfig {
  const typeEntry =
    catalogue?.beadTypes?.find((t) => t.id === typeIdOrSlug || t.slug === typeIdOrSlug) ?? null;
  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
  });
}

/** Resolve by sub-type id when sub-type context is available. */
export function resolveStrandRenderConfigForSubBeadType(
  subTypeId: string | undefined,
  catalogue?: StrandRenderCatalogueContext,
): ResolvedStrandRenderConfig {
  const subTypeEntry = catalogue?.subBeadTypes?.find((s) => s.id === subTypeId) ?? null;
  const typeEntry =
    catalogue?.beadTypes?.find((t) => t.id === subTypeEntry?.beadTypeId) ?? null;

  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
    subBeadTypeOverride: subTypeOverrideFromEntry(subTypeEntry),
    inheritSubBeadTypeFromBeadType: subBeadTypeInheritsBeadTypeStrandDefaults(subTypeEntry?.metadata),
  });
}

/** @deprecated Use resolveStrandRenderConfigForType with catalogue context */
export function resolveStrandRenderProfileBySlug(
  slug: string | undefined,
  catalogue?: StrandRenderCatalogueContext,
): StrandRenderProfile {
  return resolveStrandRenderConfigForType(slug, catalogue);
}

export function buildStrandRenderConfigCache(
  libraries: BeadLibraryEntry[],
  catalogue: StrandRenderCatalogueContext,
): Map<string, ResolvedStrandRenderConfig> {
  const map = new Map<string, ResolvedStrandRenderConfig>();
  for (const lib of libraries) {
    map.set(lib.id, resolveStrandRenderConfigForBead(lib, catalogue));
  }
  return map;
}

export function strandRenderCacheVersion(
  catalogue: StrandRenderCatalogueContext,
  libraries: Array<{ id: string; metadata?: Record<string, unknown> | null }> = [],
): string {
  const typesStamp = (catalogue.beadTypes ?? [])
    .map((t) => `${t.id}:${JSON.stringify(t.metadata?.strandRender ?? null)}`)
    .join("|");
  const subTypesStamp = subBeadTypesStrandRenderStamp(catalogue.subBeadTypes ?? []);
  const systemStamp = JSON.stringify(catalogue.strandRenderDefaults ?? null);
  const librariesStamp = beadLibrariesStrandRenderStamp(libraries);
  return `${systemStamp}::${typesStamp}::${subTypesStamp}::${librariesStamp}`;
}
