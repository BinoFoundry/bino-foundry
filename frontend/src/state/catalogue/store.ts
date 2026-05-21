import type {
  CharmEntry,
  CharmTypeEntry,
  CrystalEntry,
  FrameEntry,
  SpacerEntry,
  SpacerTypeEntry,
  TypeEntry,
} from "@/types/catalogue";

export const CATALOGUE_STORAGE_KEY = "bino_catalogue_v4";

export interface CatalogueStore {
  crystals: CrystalEntry[];
  charms: CharmEntry[];
  spacers: SpacerEntry[];
  frames: FrameEntry[];
  types: TypeEntry[];
  charmTypes: CharmTypeEntry[];
  spacerTypes: SpacerTypeEntry[];
}

export function loadFromStorage(): Partial<CatalogueStore> {
  return {};
}

export function saveToStorage(_data: CatalogueStore): void {
  // Catalogue state is API-driven; local persistence intentionally disabled.
}

/** Merge stored overrides on top of defaults by `id`. */
export function mergeById<T extends { id: string }>(defaults: T[], stored: T[]): T[] {
  const map = new Map(defaults.map((d) => [d.id, d]));
  stored.forEach((s) => {
    const existing = map.get(s.id);
    map.set(s.id, existing ? { ...existing, ...s } : s);
  });
  return Array.from(map.values());
}

export function createInitialCatalogueStore(): CatalogueStore {
  return {
    crystals: [],
    charms: [],
    spacers: [],
    frames: [],
    types: [],
    charmTypes: [],
    spacerTypes: [],
  };
}

let snapshot: CatalogueStore = createInitialCatalogueStore();

export function getCatalogueSnapshot(): CatalogueStore {
  return snapshot;
}

export function syncCatalogueSnapshot(next: CatalogueStore): void {
  snapshot = next;
}
