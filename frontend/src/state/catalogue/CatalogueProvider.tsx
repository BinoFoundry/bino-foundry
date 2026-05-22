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

import { beadsApi } from "@/services/api/beads";
import { catalogueApi } from "@/services/api";
import { isApiError } from "@/services/api/errors";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import type { FrameEntry } from "@/types/catalogue";

import {
  CATALOGUE_STORAGE_KEY,
  createInitialCatalogueStore,
  saveToStorage,
  syncCatalogueSnapshot,
  type CatalogueStore,
} from "./store";

export interface CatalogueActions {
  addBeadLibrary: (entry: BeadLibraryEntry) => Promise<void>;
  updateBeadLibrary: (entry: BeadLibraryEntry) => Promise<void>;
  updateBeadCrop: (
    publicId: string,
    payload: Parameters<typeof beadsApi.updateCrop>[1],
  ) => Promise<void>;
  deleteBeadLibrary: (id: string) => Promise<void>;
  addBeadType: (entry: Pick<BeadTypeEntry, "name" | "description">) => Promise<void>;
  updateBeadType: (entry: BeadTypeEntry) => Promise<void>;
  deleteBeadType: (id: string) => Promise<void>;
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
      const [frames, beadTypes, beadLibraries] = await Promise.all([
        catalogueApi.listFrames(),
        beadsApi.listTypes(),
        beadsApi.listLibraries(),
      ]);
      const next: CatalogueStore = { frames, beadTypes, beadLibraries };
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

  const addBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry) => {
      await beadsApi.createLibrary(entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const updateBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry) => {
      await beadsApi.updateLibrary(entry.id, entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const updateBeadCrop = useCallback(
    async (publicId: string, payload: Parameters<typeof beadsApi.updateCrop>[1]) => {
      await beadsApi.updateCrop(publicId, payload);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const deleteBeadLibrary = useCallback(
    async (id: string) => {
      await beadsApi.deleteLibrary(id);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const addBeadType = useCallback(
    async (entry: Pick<BeadTypeEntry, "name" | "description">) => {
      await beadsApi.createType(entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const updateBeadType = useCallback(
    async (entry: BeadTypeEntry) => {
      await beadsApi.updateType(entry.id, entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const deleteBeadType = useCallback(
    async (id: string) => {
      await beadsApi.deleteType(id);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const addFrame = useCallback(
    async (entry: FrameEntry) => {
      await catalogueApi.createFrame(entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const updateFrame = useCallback(
    async (entry: FrameEntry) => {
      await catalogueApi.updateFrame(entry.id, entry);
      await refreshFromApi();
    },
    [refreshFromApi],
  );

  const deleteFrame = useCallback(
    async (id: string) => {
      await catalogueApi.deleteFrame(id);
      await refreshFromApi();
    },
    [refreshFromApi],
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
      addBeadType,
      updateBeadType,
      deleteBeadType,
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
      addBeadType,
      updateBeadType,
      deleteBeadType,
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
