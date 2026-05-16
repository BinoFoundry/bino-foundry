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

import { DEFAULT_CRYSTALS } from "@/data/crystals";
import { DEFAULT_FRAMES } from "@/data/glasses";
import { catalogueApi } from "@/services/api";
import { isApiError } from "@/services/api/errors";
import type { CrystalEntry, FrameEntry, TypeEntry } from "@/types/catalogue";

import {
  CATALOGUE_STORAGE_KEY,
  createInitialCatalogueStore,
  mergeById,
  saveToStorage,
  syncCatalogueSnapshot,
  type CatalogueStore,
} from "./store";

export interface CatalogueActions {
  addCrystal: (entry: CrystalEntry) => void;
  updateCrystal: (entry: CrystalEntry) => void;
  deleteCrystal: (id: string) => void;
  addFrame: (entry: FrameEntry) => void;
  updateFrame: (entry: FrameEntry) => void;
  deleteFrame: (id: string) => void;
  addType: (entry: TypeEntry) => void;
  updateType: (entry: TypeEntry) => void;
  deleteType: (id: string) => void;
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
      const [frames, crystals, types] = await Promise.all([
        catalogueApi.listFrames(),
        catalogueApi.listCrystals(),
        catalogueApi.listTypes(),
      ]);

      setStore((prev) => {
        const next: CatalogueStore = {
          crystals:
            crystals.length > 0 ? mergeById(DEFAULT_CRYSTALS, crystals) : prev.crystals,
          frames: frames.length > 0 ? mergeById(DEFAULT_FRAMES, frames) : prev.frames,
          types: types.length > 0 ? mergeById([], types) : prev.types,
        };
        saveToStorage(next);
        syncCatalogueSnapshot(next);
        return next;
      });
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

  const addCrystal = useCallback((entry: CrystalEntry) => {
    setStore((prev) => {
      const next = { ...prev, crystals: [...prev.crystals, entry] };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.createCrystal(entry).catch((err) => console.error("createCrystal", err));
  }, []);

  const updateCrystal = useCallback((entry: CrystalEntry) => {
    setStore((prev) => {
      const next = {
        ...prev,
        crystals: prev.crystals.map((c) => (c.id === entry.id ? entry : c)),
      };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.updateCrystal(entry.id, entry).catch((err) => console.error("updateCrystal", err));
  }, []);

  const deleteCrystal = useCallback((id: string) => {
    setStore((prev) => {
      const next = { ...prev, crystals: prev.crystals.filter((c) => c.id !== id) };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.deleteCrystal(id).catch((err) => console.error("deleteCrystal", err));
  }, []);

  const addFrame = useCallback((entry: FrameEntry) => {
    setStore((prev) => {
      const next = { ...prev, frames: [...prev.frames, entry] };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.createFrame(entry).catch((err) => console.error("createFrame", err));
  }, []);

  const updateFrame = useCallback((entry: FrameEntry) => {
    setStore((prev) => {
      const next = {
        ...prev,
        frames: prev.frames.map((f) => (f.id === entry.id ? entry : f)),
      };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.updateFrame(entry.id, entry).catch((err) => console.error("updateFrame", err));
  }, []);

  const deleteFrame = useCallback((id: string) => {
    setStore((prev) => {
      const next = { ...prev, frames: prev.frames.filter((f) => f.id !== id) };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.deleteFrame(id).catch((err) => console.error("deleteFrame", err));
  }, []);

  const addType = useCallback((entry: TypeEntry) => {
    void catalogueApi
      .createType({ name: entry.name, description: entry.description })
      .then((saved) => {
        setStore((prev) => {
          const next = { ...prev, types: [...prev.types, saved] };
          saveToStorage(next);
          syncCatalogueSnapshot(next);
          return next;
        });
      })
      .catch((err) => console.error("createType", err));
  }, []);

  const updateType = useCallback((entry: TypeEntry) => {
    setStore((prev) => {
      const next = {
        ...prev,
        types: prev.types.map((t) => (t.id === entry.id ? entry : t)),
      };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.updateType(entry.id, entry).catch((err) => console.error("updateType", err));
  }, []);

  const deleteType = useCallback((id: string) => {
    setStore((prev) => {
      const next = { ...prev, types: prev.types.filter((t) => t.id !== id) };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      return next;
    });
    void catalogueApi.deleteType(id).catch((err) => console.error("deleteType", err));
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(CATALOGUE_STORAGE_KEY);
    const next: CatalogueStore = {
      crystals: [...DEFAULT_CRYSTALS],
      frames: [...DEFAULT_FRAMES],
      types: [],
    };
    persist(next, setStore);
  }, []);

  const value = useMemo<CatalogueContextValue>(
    () => ({
      ...store,
      isHydrating,
      hydrateError,
      addCrystal,
      updateCrystal,
      deleteCrystal,
      addFrame,
      updateFrame,
      deleteFrame,
      addType,
      updateType,
      deleteType,
      resetToDefaults,
      refreshFromApi,
    }),
    [
      store,
      isHydrating,
      hydrateError,
      addCrystal,
      updateCrystal,
      deleteCrystal,
      addFrame,
      updateFrame,
      deleteFrame,
      addType,
      updateType,
      deleteType,
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
