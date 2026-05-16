import { useCatalogueContext, type CatalogueContextValue } from "./CatalogueProvider";

/** Phase-1 catalogue hook (local optimistic state + Express API sync). */
export function useCatalogue(): CatalogueContextValue {
  return useCatalogueContext();
}

export type { CatalogueContextValue as CatalogueState };
