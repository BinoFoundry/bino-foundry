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

import { sunglassesApi } from "@/services/api/sunglasses";
import { LENS_RENDER_SYSTEM_DEFAULTS } from "@bino-foundry/shared/types";
import { isApiError } from "@/services/api/errors";
import { normalizeSunglassesCatalog } from "@/types/normalize-lens-tint";
import type {
  BuilderOptionEntry,
  LensTintEntry,
  SunglassesCatalogSnapshot,
} from "@/types/sunglasses-catalog";

const EMPTY_CATALOG: SunglassesCatalogSnapshot = {
  lensTints: [],
  builderOptions: [],
  lensRenderPresets: [],
  lensRenderSystemDefaults: { ...LENS_RENDER_SYSTEM_DEFAULTS },
  lensMaterialProfiles: [],
  lensDisclaimer: "",
};

export interface SunglassesCatalogActions {
  refreshFromApi: () => Promise<void>;
  refreshAdminFromApi: () => Promise<void>;
  createLensTint: (payload: Omit<LensTintEntry, "id">) => Promise<void>;
  updateLensTint: (entry: LensTintEntry) => Promise<void>;
  deleteLensTint: (id: string) => Promise<void>;
  createBuilderOption: (payload: Omit<BuilderOptionEntry, "id">) => Promise<void>;
  updateBuilderOption: (entry: BuilderOptionEntry) => Promise<void>;
  deleteBuilderOption: (id: string) => Promise<void>;
}

export type SunglassesCatalogContextValue = SunglassesCatalogSnapshot &
  SunglassesCatalogActions & {
    isHydrating: boolean;
    hydrateError: string | null;
    classicTints: LensTintEntry[];
    gradientTints: LensTintEntry[];
    getTintById: (id: string) => LensTintEntry | undefined;
    getOptionByCode: (code: string) => BuilderOptionEntry | undefined;
  };

const SunglassesCatalogContext = createContext<SunglassesCatalogContextValue | null>(null);

export function SunglassesCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<SunglassesCatalogSnapshot>(EMPTY_CATALOG);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const hydratedOnce = useRef(false);

  const refreshFromApi = useCallback(async () => {
    setIsHydrating(true);
    setHydrateError(null);
    try {
      const data = normalizeSunglassesCatalog(await sunglassesApi.getCatalog());
      setCatalog(data);
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load sunglasses catalog";
      setHydrateError(message);
      console.error("Sunglasses catalog hydrate failed:", error);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  const refreshAdminFromApi = useCallback(async () => {
    setIsHydrating(true);
    setHydrateError(null);
    try {
      const data = normalizeSunglassesCatalog(await sunglassesApi.getAdminCatalog());
      setCatalog(data);
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load sunglasses admin catalog";
      setHydrateError(message);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (hydratedOnce.current) return;
    hydratedOnce.current = true;
    void refreshFromApi();
  }, [refreshFromApi]);

  const createLensTint = useCallback(async (payload: Omit<LensTintEntry, "id">) => {
    await sunglassesApi.createLensTint(payload);
    await refreshAdminFromApi();
  }, [refreshAdminFromApi]);

  const updateLensTint = useCallback(
    async (entry: LensTintEntry) => {
      await sunglassesApi.updateLensTint(entry.id, entry);
      await refreshAdminFromApi();
    },
    [refreshAdminFromApi],
  );

  const deleteLensTint = useCallback(
    async (id: string) => {
      await sunglassesApi.deleteLensTint(id);
      await refreshAdminFromApi();
    },
    [refreshAdminFromApi],
  );

  const createBuilderOption = useCallback(
    async (payload: Omit<BuilderOptionEntry, "id">) => {
      await sunglassesApi.createBuilderOption(payload);
      await refreshAdminFromApi();
    },
    [refreshAdminFromApi],
  );

  const updateBuilderOption = useCallback(
    async (entry: BuilderOptionEntry) => {
      await sunglassesApi.updateBuilderOption(entry.id, entry);
      await refreshAdminFromApi();
    },
    [refreshAdminFromApi],
  );

  const deleteBuilderOption = useCallback(
    async (id: string) => {
      await sunglassesApi.deleteBuilderOption(id);
      await refreshAdminFromApi();
    },
    [refreshAdminFromApi],
  );

  const value = useMemo<SunglassesCatalogContextValue>(() => {
    const classicTints = catalog.lensTints.filter((t) => t.category === "classic");
    const gradientTints = catalog.lensTints.filter((t) => t.category === "gradient");

    return {
      ...catalog,
      isHydrating,
      hydrateError,
      classicTints,
      gradientTints,
      refreshFromApi,
      refreshAdminFromApi,
      createLensTint,
      updateLensTint,
      deleteLensTint,
      createBuilderOption,
      updateBuilderOption,
      deleteBuilderOption,
      getTintById: (id: string) => catalog.lensTints.find((t) => t.id === id),
      getOptionByCode: (code: string) => catalog.builderOptions.find((o) => o.code === code),
    };
  }, [
    catalog,
    isHydrating,
    hydrateError,
    refreshFromApi,
    refreshAdminFromApi,
    createLensTint,
    updateLensTint,
    deleteLensTint,
    createBuilderOption,
    updateBuilderOption,
    deleteBuilderOption,
  ]);

  return (
    <SunglassesCatalogContext.Provider value={value}>{children}</SunglassesCatalogContext.Provider>
  );
}

export function useSunglassesCatalog(): SunglassesCatalogContextValue {
  const ctx = useContext(SunglassesCatalogContext);
  if (!ctx) {
    throw new Error("useSunglassesCatalog must be used within SunglassesCatalogProvider");
  }
  return ctx;
}
