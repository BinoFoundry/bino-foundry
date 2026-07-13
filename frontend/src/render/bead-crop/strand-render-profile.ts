import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  beadLibrariesStrandRenderStamp,
  beadLibraryInheritsTypeStrandDefaults,
  parseStrandRenderProfile,
  resolveStrandRenderConfig,
  subBeadTypeInheritsBeadTypeStrandDefaults,
  subBeadTypesStrandRenderStamp,
  type ResolvedStrandRenderConfig,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

export type { ResolvedStrandRenderConfig, StrandRenderProfile };

export interface StrandRenderCatalogueContext {
  beadTypes?: BeadTypeEntry[];
  subBeadTypes?: SubBeadTypeEntry[];
  /** Platform defaults from config_kv — loaded once with catalogue. */
  strandRenderDefaults?: StrandRenderProfile | null;
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
  return parseStrandRenderProfile(meta?.strandRender);
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
  const typeEntry = beadTypeFor(bead, catalogue);
  const subTypeEntry = subBeadTypeFor(bead, catalogue);

  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
    subBeadTypeOverride: subTypeOverrideFromEntry(subTypeEntry),
    inheritSubBeadTypeFromBeadType: subBeadTypeInheritsBeadTypeStrandDefaults(subTypeEntry?.metadata),
    beadOverride: libraryOverrideFromEntry(bead),
    inheritBeadFromSubBeadType: libraryInheritsSubTypeDefaults(bead),
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
