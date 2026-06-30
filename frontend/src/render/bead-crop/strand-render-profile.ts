import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import {
  beadLibrariesStrandRenderStamp,
  parseStrandRenderProfile,
  resolveStrandRenderConfig,
  type ResolvedStrandRenderConfig,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

export type { ResolvedStrandRenderConfig, StrandRenderProfile };

export interface StrandRenderCatalogueContext {
  beadTypes?: BeadTypeEntry[];
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

function typeDefaultsFromEntry(type: BeadTypeEntry | null): Partial<StrandRenderProfile> | null {
  if (!type) return null;
  const meta = type.metadata as { strandRender?: unknown } | undefined;
  return parseStrandRenderProfile(meta?.strandRender);
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

function libraryInheritsTypeDefaults(bead: BeadLibraryEntry | null | undefined): boolean {
  const meta = bead?.metadata as { useTypeStrandDefaults?: boolean; strandRenderOverride?: unknown } | undefined;
  if (meta?.useTypeStrandDefaults === true) return true;
  if (meta?.strandRenderOverride == null) return true;
  return false;
}

/** Resolve hierarchical config for one bead library entry. */
export function resolveStrandRenderConfigForBead(
  bead: BeadLibraryEntry | null | undefined,
  catalogue?: StrandRenderCatalogueContext,
): ResolvedStrandRenderConfig {
  const typeEntry = beadTypeFor(bead, catalogue);
  return resolveStrandRenderConfig({
    systemDefaults: catalogue?.strandRenderDefaults ?? null,
    beadTypeDefaults: typeDefaultsFromEntry(typeEntry),
    beadOverride: libraryOverrideFromEntry(bead),
    inheritTypeDefaults: libraryInheritsTypeDefaults(bead),
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
  const systemStamp = JSON.stringify(catalogue.strandRenderDefaults ?? null);
  const librariesStamp = beadLibrariesStrandRenderStamp(libraries);
  return `${systemStamp}::${typesStamp}::${librariesStamp}`;
}
