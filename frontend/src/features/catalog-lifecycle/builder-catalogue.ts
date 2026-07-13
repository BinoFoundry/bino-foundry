import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import type { CatalogAvailabilityStatus } from "@/types/catalog-availability";

import { isCatalogItemVisibleInBuilder } from "./visibility";

/** Whether a bead type or sub-type row is selectable in builders (DB is_active). */
export function isCatalogueTaxonomyActive(isActive: boolean | undefined | null): boolean {
  return isActive !== false;
}

export function buildBuilderStatusMap(
  statuses: CatalogAvailabilityStatus[],
): Map<string, { showInBuilder: boolean }> {
  return new Map(statuses.map((s) => [s.code, { showInBuilder: s.showInBuilder }]));
}

export interface BuilderCatalogueSlice {
  beadTypes: BeadTypeEntry[];
  subBeadTypes: SubBeadTypeEntry[];
  beadLibraries: BeadLibraryEntry[];
  builderStatusByCode: Map<string, { showInBuilder: boolean }>;
  activeTypeIds: Set<string>;
  activeSubTypeIds: Set<string>;
}

/**
 * Builder-facing catalogue — cascades inactive bead types to sub-types and library beads.
 * Admin keeps the full catalogue; only selection UI should use this slice.
 */
export function selectBuilderCatalogue(input: {
  beadTypes: BeadTypeEntry[];
  subBeadTypes: SubBeadTypeEntry[];
  beadLibraries: BeadLibraryEntry[];
  catalogAvailabilityStatuses: CatalogAvailabilityStatus[];
}): BuilderCatalogueSlice {
  const builderStatusByCode = buildBuilderStatusMap(input.catalogAvailabilityStatuses);

  const beadTypes = input.beadTypes.filter((t) => isCatalogueTaxonomyActive(t.isActive));
  const activeTypeIds = new Set(beadTypes.map((t) => t.id));

  const subBeadTypes = input.subBeadTypes.filter(
    (s) => activeTypeIds.has(s.beadTypeId) && isCatalogueTaxonomyActive(s.isActive),
  );
  const activeSubTypeIds = new Set(subBeadTypes.map((s) => s.id));

  const beadLibraries = input.beadLibraries.filter((bead) => {
    if (!activeTypeIds.has(bead.beadTypeId)) return false;
    if (bead.subBeadTypeId && !activeSubTypeIds.has(bead.subBeadTypeId)) return false;
    return isCatalogItemVisibleInBuilder(
      bead.availabilityStatusCode,
      bead.isActive,
      builderStatusByCode,
    );
  });

  return {
    beadTypes,
    subBeadTypes,
    beadLibraries,
    builderStatusByCode,
    activeTypeIds,
    activeSubTypeIds,
  };
}
