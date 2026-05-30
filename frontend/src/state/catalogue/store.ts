import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { FrameEntry } from "@/types/catalogue";

export const CATALOGUE_STORAGE_KEY = "bino_catalogue_v5";

export interface CatalogueStore {
  beadTypes: BeadTypeEntry[];
  beadSizes: BeadSizeEntry[];
  beadLibraries: BeadLibraryEntry[];
  frames: FrameEntry[];
}

export function loadFromStorage(): Partial<CatalogueStore> {
  return {};
}

export function saveToStorage(_data: CatalogueStore): void {
  // Catalogue state is API-driven; local persistence intentionally disabled.
}

export function createInitialCatalogueStore(): CatalogueStore {
  return {
    beadTypes: [],
    beadSizes: [],
    beadLibraries: [],
    frames: [],
  };
}

let snapshot: CatalogueStore = createInitialCatalogueStore();

export function getCatalogueSnapshot(): CatalogueStore {
  return snapshot;
}

export function syncCatalogueSnapshot(next: CatalogueStore): void {
  snapshot = next;
}

/** Resolve bead type slug from id. */
export function beadTypeSlugById(types: BeadTypeEntry[], typeId: string | undefined): string | undefined {
  if (!typeId) return undefined;
  return types.find((t) => t.id === typeId)?.slug;
}
