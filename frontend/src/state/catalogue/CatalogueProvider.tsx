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

import { catalogueApi } from "@/services/api";
import { isApiError } from "@/services/api/errors";
import type {
  CharmEntry,
  CharmTypeEntry,
  CrystalEntry,
  FrameEntry,
  SpacerEntry,
  SpacerTypeEntry,
  TypeEntry,
} from "@/types/catalogue";

import {
  CATALOGUE_STORAGE_KEY,
  createInitialCatalogueStore,
  saveToStorage,
  syncCatalogueSnapshot,
  type CatalogueStore,
} from "./store";

export interface CatalogueActions {
  addCrystal: (entry: CrystalEntry) => Promise<void>;
  updateCrystal: (entry: CrystalEntry) => Promise<void>;
  deleteCrystal: (id: string) => Promise<void>;
  addCharm: (entry: CharmEntry) => Promise<void>;
  updateCharm: (entry: CharmEntry) => Promise<void>;
  deleteCharm: (id: string) => Promise<void>;
  addSpacer: (entry: SpacerEntry) => Promise<void>;
  updateSpacer: (entry: SpacerEntry) => Promise<void>;
  deleteSpacer: (id: string) => Promise<void>;
  addFrame: (entry: FrameEntry) => Promise<void>;
  updateFrame: (entry: FrameEntry) => Promise<void>;
  deleteFrame: (id: string) => Promise<void>;
  addType: (entry: TypeEntry) => Promise<void>;
  updateType: (entry: TypeEntry) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
  addCharmType: (entry: CharmTypeEntry) => Promise<void>;
  updateCharmType: (entry: CharmTypeEntry) => Promise<void>;
  deleteCharmType: (id: string) => Promise<void>;
  addSpacerType: (entry: SpacerTypeEntry) => Promise<void>;
  updateSpacerType: (entry: SpacerTypeEntry) => Promise<void>;
  deleteSpacerType: (id: string) => Promise<void>;
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
      const [frames, crystals, charms, spacers, types, charmTypes, spacerTypes] = await Promise.all([
        catalogueApi.listFrames(),
        catalogueApi.listCrystals(),
        catalogueApi.listCharms(),
        catalogueApi.listSpacers(),
        catalogueApi.listTypes(),
        catalogueApi.listCharmTypes(),
        catalogueApi.listSpacerTypes(),
      ]);
      const next: CatalogueStore = {
        crystals,
        charms,
        spacers,
        frames,
        types,
        charmTypes,
        spacerTypes,
      };
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

  const addCrystal = useCallback(async (entry: CrystalEntry) => {
    await catalogueApi.createCrystal(entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateCrystal = useCallback(async (entry: CrystalEntry) => {
    await catalogueApi.updateCrystal(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteCrystal = useCallback(async (id: string) => {
    await catalogueApi.deleteCrystal(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addCharm = useCallback(async (entry: CharmEntry) => {
    await catalogueApi.createCharm(entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateCharm = useCallback(async (entry: CharmEntry) => {
    await catalogueApi.updateCharm(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteCharm = useCallback(async (id: string) => {
    await catalogueApi.deleteCharm(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addSpacer = useCallback(async (entry: SpacerEntry) => {
    await catalogueApi.createSpacer(entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateSpacer = useCallback(async (entry: SpacerEntry) => {
    await catalogueApi.updateSpacer(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteSpacer = useCallback(async (id: string) => {
    await catalogueApi.deleteSpacer(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addFrame = useCallback(async (entry: FrameEntry) => {
    await catalogueApi.createFrame(entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateFrame = useCallback(async (entry: FrameEntry) => {
    await catalogueApi.updateFrame(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteFrame = useCallback(async (id: string) => {
    await catalogueApi.deleteFrame(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addType = useCallback(async (entry: TypeEntry) => {
    await catalogueApi.createType({ name: entry.name, description: entry.description });
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateType = useCallback(async (entry: TypeEntry) => {
    await catalogueApi.updateType(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteType = useCallback(async (id: string) => {
    await catalogueApi.deleteType(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addCharmType = useCallback(async (entry: CharmTypeEntry) => {
    await catalogueApi.createCharmType({ name: entry.name, description: entry.description });
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateCharmType = useCallback(async (entry: CharmTypeEntry) => {
    await catalogueApi.updateCharmType(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteCharmType = useCallback(async (id: string) => {
    await catalogueApi.deleteCharmType(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const addSpacerType = useCallback(async (entry: SpacerTypeEntry) => {
    await catalogueApi.createSpacerType({ name: entry.name, description: entry.description });
    await refreshFromApi();
  }, [refreshFromApi]);

  const updateSpacerType = useCallback(async (entry: SpacerTypeEntry) => {
    await catalogueApi.updateSpacerType(entry.id, entry);
    await refreshFromApi();
  }, [refreshFromApi]);

  const deleteSpacerType = useCallback(async (id: string) => {
    await catalogueApi.deleteSpacerType(id);
    await refreshFromApi();
  }, [refreshFromApi]);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(CATALOGUE_STORAGE_KEY);
    const next: CatalogueStore = {
      crystals: [],
      charms: [],
      spacers: [],
      frames: [],
      types: [],
      charmTypes: [],
      spacerTypes: [],
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
      addCharm,
      updateCharm,
      deleteCharm,
      addSpacer,
      updateSpacer,
      deleteSpacer,
      addFrame,
      updateFrame,
      deleteFrame,
      addType,
      updateType,
      deleteType,
      addCharmType,
      updateCharmType,
      deleteCharmType,
      addSpacerType,
      updateSpacerType,
      deleteSpacerType,
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
      addCharm,
      updateCharm,
      deleteCharm,
      addSpacer,
      updateSpacer,
      deleteSpacer,
      addFrame,
      updateFrame,
      deleteFrame,
      addType,
      updateType,
      deleteType,
      addCharmType,
      updateCharmType,
      deleteCharmType,
      addSpacerType,
      updateSpacerType,
      deleteSpacerType,
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
