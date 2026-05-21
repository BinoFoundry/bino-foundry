import { useCatalogueContext, type CatalogueContextValue } from "./CatalogueProvider";

/** Catalogue hook (Supabase-backed via API). */
export function useCatalogue(): CatalogueContextValue {
  return useCatalogueContext();
}

export type { CatalogueContextValue as CatalogueState };
