import { useMemo } from "react";

import { buildBuilderStatusMap } from "@/features/catalog-lifecycle/builder-catalogue";

import { useCatalogueContext } from "./CatalogueProvider";

/** Builder-scoped catalogue rows — filtered at the API (`?forBuilder=1`). */
export function useBuilderCatalogue() {
  const {
    builderBeadTypes,
    builderSubBeadTypes,
    builderBeadLibraries,
    catalogAvailabilityStatuses,
  } = useCatalogueContext();

  const builderStatusByCode = useMemo(
    () => buildBuilderStatusMap(catalogAvailabilityStatuses),
    [catalogAvailabilityStatuses],
  );

  const activeTypeIds = useMemo(
    () => new Set(builderBeadTypes.map((type) => type.id)),
    [builderBeadTypes],
  );

  const activeSubTypeIds = useMemo(
    () => new Set(builderSubBeadTypes.map((subType) => subType.id)),
    [builderSubBeadTypes],
  );

  return {
    beadTypes: builderBeadTypes,
    subBeadTypes: builderSubBeadTypes,
    beadLibraries: builderBeadLibraries,
    catalogAvailabilityStatuses,
    builderStatusByCode,
    activeTypeIds,
    activeSubTypeIds,
  };
}
