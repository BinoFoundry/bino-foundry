import { DEFAULT_CRYSTALS } from "@/data/crystals";
import { DEFAULT_FRAMES } from "@/data/glasses";
import type { CrystalEntry, FrameEntry, TypeEntry } from "@/types/catalogue";

export const CATALOGUE_STORAGE_KEY = "bino_catalogue_v3";

export interface CatalogueStore {
  crystals: CrystalEntry[];
  frames: FrameEntry[];
  types: TypeEntry[];
}

export function loadFromStorage(): Partial<CatalogueStore> {
  try {
    const raw = localStorage.getItem(CATALOGUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<CatalogueStore>) : {};
  } catch {
    return {};
  }
}

export function saveToStorage(data: CatalogueStore): void {
  try {
    localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota / private mode
  }
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
  const saved = loadFromStorage();
  return {
    crystals: mergeById(DEFAULT_CRYSTALS, saved.crystals ?? []),
    frames: mergeById(DEFAULT_FRAMES, saved.frames ?? []),
    types: mergeById([], saved.types ?? []),
  };
}

let snapshot: CatalogueStore = createInitialCatalogueStore();

export function getCatalogueSnapshot(): CatalogueStore {
  return snapshot;
}

export function syncCatalogueSnapshot(next: CatalogueStore): void {
  snapshot = next;
}
