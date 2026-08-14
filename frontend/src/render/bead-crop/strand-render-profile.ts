import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  beadLibrariesStrandRenderStamp,
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseBeadPlacementMode,
  parseStrandRenderProfile,
  partialStrandOverrideFromMetadata,
  resolveStrandRenderConfig,
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
  beadLibraries?: BeadLibraryEntry[];
  strandRenderDefaults?: StrandRenderProfile | null;
}

export interface HydrateBeadLibraryOptions {
  preferDraftIdentity?: boolean;
}

export function hydrateBeadLibraryForStrandRender(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
  options?: HydrateBeadLibraryOptions,
): BeadLibraryEntry | null | undefined {
  if (!bead?.id || !catalogue?.beadLibraries?.length) return bead;
  if (options?.preferDraftIdentity) return bead;
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
  const placementMode = parseBeadPlacementMode(type.placementMode);
  return { ...(fromMeta ?? {}), placementMode };
}

/** Resolve hierarchical config for one bead library entry. */
export function resolveStrandRenderConfigForBead(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
  options?: HydrateBeadLibraryOptions,
): ResolvedStrandRenderConfig {
  const frozenRaw = (bead?.metadata as { frozenStrandRenderProfile?: unknown } | undefined)
    ?.frozenStrandRenderProfile;
  if (frozenRaw && typeof frozenRaw === "object") {
    const profile = mergeStrandRenderProfile(
      DEFAULT_STRAND_RENDER_PROFILE,
      parseStrandRenderProfile(frozenRaw),
    );
    const provenance = Object.fromEntries(
      STRAND_RENDER_PROFILE_KEYS.map((key) => [key, "beadOverride" as StrandRenderConfigSource]),
    ) as Record<StrandRenderProfileKey, StrandRenderConfigSource>;
    return { ...profile, provenance, resolvedRenderScale: profile.visualScale, imageSizeAdjust: 1 };
  }

  const hydrated = hydrateBeadLibraryForStrandRender(bead, catalogue, options);
  const typeEntry = beadTypeFor(hydrated, catalogue);
  const subTypeEntry = subBeadTypeFor(hydrated, catalogue);

  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
    subBeadTypePartialOverride: partialStrandOverrideFromMetadata(subTypeEntry?.metadata ?? null),
    beadPartialOverride: partialStrandOverrideFromMetadata(hydrated?.metadata ?? null),
  });
}

/** @deprecated Use resolveStrandRenderConfigForBead */
export function resolveStrandRenderProfile(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
  options?: HydrateBeadLibraryOptions,
): StrandRenderProfile {
  return resolveStrandRenderConfigForBead(bead, catalogue, options);
}

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
    subBeadTypePartialOverride: partialStrandOverrideFromMetadata(subTypeEntry?.metadata ?? null),
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
