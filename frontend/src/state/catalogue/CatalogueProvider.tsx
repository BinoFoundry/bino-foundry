import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { beadSizesApi } from "@/services/api/bead-sizes";
import { wristSizesApi } from "@/services/api/wrist-sizes";
import { beadLibrarySizesApi } from "@/services/api/bead-library-sizes";
import { beadsApi } from "@/services/api/beads";
import { catalogueApi } from "@/services/api";
import { isApiError } from "@/services/api/errors";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";
import type { FrameEntry } from "@/types/catalogue";

import {
  CATALOGUE_STORAGE_KEY,
  createInitialCatalogueStore,
  saveToStorage,
  syncCatalogueSnapshot,
  type CatalogueStore,
} from "./store";

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx < 0) return [...list, item];
  const next = list.slice();
  next[idx] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export interface CatalogueActions {
  addBeadLibrary: (entry: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]) => Promise<void>;
  updateBeadLibrary: (entry: BeadLibraryEntry) => Promise<void>;
  updateBeadCrop: (
    publicId: string,
    payload: Parameters<typeof beadsApi.updateCrop>[1],
  ) => Promise<void>;
  deleteBeadLibrary: (id: string) => Promise<void>;
  recalculateBeadBoundsMetadata: () => Promise<{ updated: number; skipped: number }>;
  recalculateMmGroupReferences: () => Promise<{ groups: number; updated: number; skipped: number }>;
  refreshBeadLibrarySizes: () => Promise<void>;
  addBeadType: (
    entry: Pick<BeadTypeEntry, "name" | "description"> & {
      displayOrder?: number;
      isActive?: boolean;
    },
  ) => Promise<void>;
  updateBeadType: (entry: BeadTypeEntry) => Promise<void>;
  deleteBeadType: (id: string) => Promise<void>;
  addBeadSize: (entry: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateBeadSize: (entry: BeadSizeEntry) => Promise<void>;
  deleteBeadSize: (id: string) => Promise<void>;
  addWristSize: (entry: Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateWristSize: (entry: WristSizeEntry) => Promise<void>;
  deleteWristSize: (id: string) => Promise<void>;
  addFrame: (entry: FrameEntry) => Promise<void>;
  updateFrame: (entry: FrameEntry) => Promise<void>;
  deleteFrame: (id: string) => Promise<void>;
  resetToDefaults: () => void;
  refreshFromApi: () => Promise<void>;
}

export type CatalogueContextValue = CatalogueStore &
  CatalogueActions & {
    isHydrating: boolean;
    hydrateError: string | null;
  };

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

function persist(next: CatalogueStore, setter: (s: CatalogueStore) => void): void {
  setter(next);
  saveToStorage(next);
  syncCatalogueSnapshot(next);
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<CatalogueStore>(createInitialCatalogueStore);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const hydratedOnce = useRef(false);

  const refreshFromApi = useCallback(async () => {
    setIsHydrating(true);
    setHydrateError(null);
    try {
      const [frames, beadTypes, beadSizes, wristSizes, beadLibrarySizes, beadLibraries] = await Promise.all([
        catalogueApi.listFrames(),
        beadsApi.listTypes(),
        beadSizesApi.list(true),
        wristSizesApi.list(true),
        beadLibrarySizesApi.list(),
        beadsApi.listLibraries(),
      ]);
      const next: CatalogueStore = { frames, beadTypes, beadSizes, wristSizes, beadLibrarySizes, beadLibraries };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      setStore(next);
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load catalogue";
      setHydrateError(message);
      console.error("Catalogue hydrate failed:", error);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    syncCatalogueSnapshot(store);
  }, [store]);

  useEffect(() => {
    if (hydratedOnce.current) return;
    hydratedOnce.current = true;
    void refreshFromApi();
  }, [refreshFromApi]);

  const mergeStore = useCallback((updater: (prev: CatalogueStore) => CatalogueStore) => {
    setStore((prev) => {
      const next = updater(prev);
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
  }, []);

  const addBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]) => {
      const [created, librarySizes] = await Promise.all([
        beadsApi.createLibrary(entry, sizes),
        beadLibrarySizesApi.list(),
      ]);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, created),
        beadLibrarySizes: librarySizes,
      }));
    },
    [mergeStore],
  );

  const updateBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry) => {
      const updated = await beadsApi.updateLibrary(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, updated),
      }));
    },
    [mergeStore],
  );

  const updateBeadCrop = useCallback(
    async (publicId: string, payload: Parameters<typeof beadsApi.updateCrop>[1]) => {
      const updated = await beadsApi.updateCrop(publicId, payload);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, updated),
      }));
    },
    [mergeStore],
  );

  const deleteBeadLibrary = useCallback(
    async (id: string) => {
      const [_, librarySizes] = await Promise.all([
        beadsApi.deleteLibrary(id),
        beadLibrarySizesApi.list(),
      ]);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: removeById(prev.beadLibraries, id),
        beadLibrarySizes: librarySizes,
      }));
    },
    [mergeStore],
  );

  const recalculateBeadBoundsMetadata = useCallback(async () => {
    const result = await beadsApi.recalculateBoundsMetadata();
    const [beadLibraries, beadLibrarySizes, beadSizes] = await Promise.all([
      beadsApi.listLibraries(),
      beadLibrarySizesApi.list(),
      beadSizesApi.list(true),
    ]);
    mergeStore((prev) => ({ ...prev, beadLibraries, beadLibrarySizes, beadSizes }));
    return result;
  }, [mergeStore]);

  const recalculateMmGroupReferences = useCallback(async () => {
    const result = await beadSizesApi.recalculateMmGroupReferences();
    const [beadLibrarySizes, beadSizes] = await Promise.all([
      beadLibrarySizesApi.list(),
      beadSizesApi.list(true),
    ]);
    mergeStore((prev) => ({ ...prev, beadLibrarySizes, beadSizes }));
    return result;
  }, [mergeStore]);

  const refreshBeadLibrarySizes = useCallback(async () => {
    const [beadLibrarySizes, beadSizes] = await Promise.all([
      beadLibrarySizesApi.list(),
      beadSizesApi.list(true),
    ]);
    mergeStore((prev) => ({ ...prev, beadLibrarySizes, beadSizes }));
  }, [mergeStore]);

  const addBeadType = useCallback(
    async (
      entry: Pick<BeadTypeEntry, "name" | "description"> & {
        displayOrder?: number;
        isActive?: boolean;
      },
    ) => {
      const created = await beadsApi.createType(entry);
      mergeStore((prev) => ({
        ...prev,
        beadTypes: replaceById(prev.beadTypes, created),
      }));
    },
    [mergeStore],
  );

  const updateBeadType = useCallback(
    async (entry: BeadTypeEntry) => {
      const updated = await beadsApi.updateType(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        beadTypes: replaceById(prev.beadTypes, updated),
      }));
    },
    [mergeStore],
  );

  const deleteBeadType = useCallback(
    async (id: string) => {
      await beadsApi.deleteType(id);
      mergeStore((prev) => ({
        ...prev,
        beadTypes: removeById(prev.beadTypes, id),
      }));
    },
    [mergeStore],
  );

  const addBeadSize = useCallback(
    async (entry: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">) => {
      const created = await beadSizesApi.create(entry);
      mergeStore((prev) => ({
        ...prev,
        beadSizes: replaceById(prev.beadSizes, created),
      }));
    },
    [mergeStore],
  );

  const updateBeadSize = useCallback(
    async (entry: BeadSizeEntry) => {
      const updated = await beadSizesApi.update(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        beadSizes: replaceById(prev.beadSizes, updated),
      }));
    },
    [mergeStore],
  );

  const deleteBeadSize = useCallback(
    async (id: string) => {
      await beadSizesApi.delete(id);
      mergeStore((prev) => ({
        ...prev,
        beadSizes: removeById(prev.beadSizes, id),
      }));
    },
    [mergeStore],
  );

  const addWristSize = useCallback(
    async (entry: Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">) => {
      const created = await wristSizesApi.create(entry);
      mergeStore((prev) => ({
        ...prev,
        wristSizes: replaceById(prev.wristSizes, created),
      }));
    },
    [mergeStore],
  );

  const updateWristSize = useCallback(
    async (entry: WristSizeEntry) => {
      const updated = await wristSizesApi.update(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        wristSizes: replaceById(prev.wristSizes, updated),
      }));
    },
    [mergeStore],
  );

  const deleteWristSize = useCallback(
    async (id: string) => {
      await wristSizesApi.delete(id);
      mergeStore((prev) => ({
        ...prev,
        wristSizes: removeById(prev.wristSizes, id),
      }));
    },
    [mergeStore],
  );

  const addFrame = useCallback(
    async (entry: FrameEntry) => {
      const created = await catalogueApi.createFrame(entry);
      mergeStore((prev) => ({
        ...prev,
        frames: replaceById(prev.frames, created),
      }));
    },
    [mergeStore],
  );

  const updateFrame = useCallback(
    async (entry: FrameEntry) => {
      const updated = await catalogueApi.updateFrame(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        frames: replaceById(prev.frames, updated),
      }));
    },
    [mergeStore],
  );

  const deleteFrame = useCallback(
    async (id: string) => {
      await catalogueApi.deleteFrame(id);
      mergeStore((prev) => ({
        ...prev,
        frames: removeById(prev.frames, id),
      }));
    },
    [mergeStore],
  );

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(CATALOGUE_STORAGE_KEY);
    const next = createInitialCatalogueStore();
    persist(next, setStore);
  }, []);

  const value = useMemo<CatalogueContextValue>(
    () => ({
      ...store,
      isHydrating,
      hydrateError,
      addBeadLibrary,
      updateBeadLibrary,
      updateBeadCrop,
      deleteBeadLibrary,
      recalculateBeadBoundsMetadata,
      recalculateMmGroupReferences,
      refreshBeadLibrarySizes,
      addBeadType,
      updateBeadType,
      deleteBeadType,
      addBeadSize,
      updateBeadSize,
      deleteBeadSize,
      addWristSize,
      updateWristSize,
      deleteWristSize,
      addFrame,
      updateFrame,
      deleteFrame,
      resetToDefaults,
      refreshFromApi,
    }),
    [
      store,
      isHydrating,
      hydrateError,
      addBeadLibrary,
      updateBeadLibrary,
      updateBeadCrop,
      deleteBeadLibrary,
      recalculateBeadBoundsMetadata,
      recalculateMmGroupReferences,
      refreshBeadLibrarySizes,
      addBeadType,
      updateBeadType,
      deleteBeadType,
      addBeadSize,
      updateBeadSize,
      deleteBeadSize,
      addWristSize,
      updateWristSize,
      deleteWristSize,
      addFrame,
      updateFrame,
      deleteFrame,
      resetToDefaults,
      refreshFromApi,
    ],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogueContext(): CatalogueContextValue {
  const ctx = useContext(CatalogueContext);
  if (!ctx) {
    throw new Error("useCatalogueContext must be used within CatalogueProvider");
  }
  return ctx;
}
