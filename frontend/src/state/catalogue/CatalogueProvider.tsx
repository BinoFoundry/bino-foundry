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

import { howWePrepareApi } from "@/services/api/how-we-prepare";
import { tagsApi } from "@/services/api/tags";
import { catalogAvailabilityStatusesApi } from "@/services/api/catalog-availability-statuses";
import { beadSizesApi } from "@/services/api/bead-sizes";
import { wristSizesApi } from "@/services/api/wrist-sizes";
import { beadLibrarySizesApi } from "@/services/api/bead-library-sizes";
import { buildBeadSaveDiff } from "@/features/admin/lib/bead-save-pipeline";
import { syncBeadRenderCalibrationFromSettings } from "@/render/bead-crop/sync-bead-render-calibration";
import { beadsApi } from "@/services/api/beads";
import { subBeadTypesApi } from "@/services/api/sub-bead-types";
import { catalogueApi, settingsApi } from "@/services/api";
import { isApiError } from "@/services/api/errors";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { WristSizeEntry } from "@/types/wrist-sizes";
import type { HowWePrepareOption } from "@bino-foundry/shared/types";
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

async function fetchBuilderCatalogueFromApi(): Promise<
  Pick<CatalogueStore, "builderBeadTypes" | "builderSubBeadTypes" | "builderBeadLibraries">
> {
  const [builderBeadTypes, builderSubBeadTypes, builderBeadLibraries] = await Promise.all([
    beadsApi.listTypes(true),
    subBeadTypesApi.list(undefined, true),
    beadsApi.listLibraries(true),
  ]);
  return { builderBeadTypes, builderSubBeadTypes, builderBeadLibraries };
}

export interface CatalogueActions {
  addBeadLibrary: (entry: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]) => Promise<BeadLibraryEntry>;
  updateBeadLibrary: (entry: BeadLibraryEntry) => Promise<BeadLibraryEntry>;
  saveBeadLibraryEntry: (
    entry: BeadLibraryEntry,
    sizes: BeadLibrarySizeInput[],
    options?: { initial?: BeadLibraryEntry; initialSizes?: BeadLibrarySizeInput[] },
  ) => Promise<BeadLibraryEntry>;
  patchBeadLibrarySizes: (libraryId: string, offers: BeadLibrarySizeOffer[]) => void;
  updateBeadCrop: (
    publicId: string,
    payload: Parameters<typeof beadsApi.updateCrop>[1],
  ) => Promise<void>;
  deleteBeadLibrary: (id: string, options?: { force?: boolean }) => Promise<void>;
  getBeadLibraryReferences: (id: string) => Promise<{ designCount: number; itemCount: number }>;
  recalculateBeadBoundsMetadata: () => Promise<{ updated: number; skipped: number }>;
  recalculateMmGroupReferences: () => Promise<{ groups: number; updated: number; skipped: number }>;
  refreshBeadLibrarySizes: () => Promise<void>;
  addBeadType: (
    entry: Pick<BeadTypeEntry, "name" | "description"> & {
      displayOrder?: number;
      isActive?: boolean;
      enableSubTypes?: boolean;
      placementMode?: BeadTypeEntry["placementMode"];
      metadata?: BeadTypeEntry["metadata"];
    },
  ) => Promise<BeadTypeEntry>;
  updateBeadType: (entry: BeadTypeEntry) => Promise<BeadTypeEntry>;
  updateStrandRenderDefaults: (
    settings: import("@bino-foundry/shared/types").StrandRenderProfile,
  ) => Promise<import("@bino-foundry/shared/types").StrandRenderProfile>;
  deleteBeadType: (id: string) => Promise<void>;
  addSubBeadType: (
    entry: Pick<SubBeadTypeEntry, "beadTypeId" | "name" | "description"> & {
      displayOrder?: number;
      isActive?: boolean;
      metadata?: SubBeadTypeEntry["metadata"];
    },
  ) => Promise<SubBeadTypeEntry>;
  updateSubBeadType: (entry: SubBeadTypeEntry) => Promise<SubBeadTypeEntry>;
  deleteSubBeadType: (id: string) => Promise<void>;
  addBeadSize: (entry: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">) => Promise<BeadSizeEntry>;
  updateBeadSize: (entry: BeadSizeEntry) => Promise<BeadSizeEntry>;
  deleteBeadSize: (id: string) => Promise<void>;
  addWristSize: (entry: Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">) => Promise<WristSizeEntry>;
  updateWristSize: (entry: WristSizeEntry) => Promise<WristSizeEntry>;
  deleteWristSize: (id: string) => Promise<void>;
  addHowWePrepareOption: (
    entry: Omit<HowWePrepareOption, "id" | "createdAt" | "updatedAt">,
  ) => Promise<HowWePrepareOption>;
  updateHowWePrepareOption: (entry: HowWePrepareOption) => Promise<HowWePrepareOption>;
  deleteHowWePrepareOption: (id: string) => Promise<void>;
  addFrame: (entry: FrameEntry) => Promise<FrameEntry>;
  updateFrame: (entry: FrameEntry) => Promise<FrameEntry>;
  /** Load full frame (incl. maskConfig) into the store — list omits heavy editor masks. */
  ensureFrameDetail: (id: string) => Promise<FrameEntry>;
  getFrameReferences: (id: string) => Promise<{ designCount: number; itemCount: number }>;
  deleteFrame: (id: string, options?: { force?: boolean }) => Promise<void>;
  /** Load full bead library (incl. cropConfig) into the store — list omits crop polygons. */
  ensureBeadLibraryDetail: (id: string) => Promise<BeadLibraryEntry>;
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
  /** Frame / bead ids that already have full editor payloads (mask/crop) in the store. */
  const frameDetailHydratedRef = useRef(new Set<string>());
  const beadDetailHydratedRef = useRef(new Set<string>());
  const storeRef = useRef(store);
  storeRef.current = store;

  const refreshFromApi = useCallback(async () => {
    setIsHydrating(true);
    setHydrateError(null);
    try {
      const [
        frames,
        beadTypes,
        subBeadTypes,
        beadSizes,
        wristSizes,
        beadLibrarySizes,
        beadLibraries,
        catalogAvailabilityStatuses,
        strandRenderDefaults,
        generalSettings,
        howWePrepareOptions,
        beadTags,
        builderCatalogue,
      ] = await Promise.all([
        catalogueApi.listFrames(),
        beadsApi.listTypes(),
        subBeadTypesApi.list(),
        beadSizesApi.list(true),
        wristSizesApi.list(true),
        beadLibrarySizesApi.list(),
        beadsApi.listLibraries(),
        catalogAvailabilityStatusesApi.list(),
        settingsApi.getStrandRenderDefaults(),
        settingsApi.getGeneralSettings(),
        howWePrepareApi.list(),
        tagsApi.list().catch(() => []),
        fetchBuilderCatalogueFromApi(),
      ]);
      syncBeadRenderCalibrationFromSettings(generalSettings);
      const next: CatalogueStore = {
        frames,
        beadTypes,
        subBeadTypes,
        beadSizes,
        wristSizes,
        beadLibrarySizes,
        beadLibraries,
        ...builderCatalogue,
        catalogAvailabilityStatuses,
        beadAvailabilityStatuses: catalogAvailabilityStatuses,
        strandRenderDefaults,
        howWePrepareOptions,
        beadTags,
      };
      saveToStorage(next);
      syncCatalogueSnapshot(next);
      frameDetailHydratedRef.current.clear();
      beadDetailHydratedRef.current.clear();
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

  const refreshBuilderCatalogue = useCallback(async () => {
    const builderCatalogue = await fetchBuilderCatalogueFromApi();
    mergeStore((prev) => ({ ...prev, ...builderCatalogue }));
  }, [mergeStore]);

  const addBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]) => {
      const created = await beadsApi.createLibrary(entry, sizes);
      const librarySizes = await beadLibrarySizesApi.list(created.id);
      beadDetailHydratedRef.current.add(created.id);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, created),
        beadLibrarySizes: [
          ...prev.beadLibrarySizes.filter((o) => o.beadLibraryId !== created.id),
          ...librarySizes,
        ],
      }));
      void refreshBuilderCatalogue();
      return created;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const updateBeadLibrary = useCallback(
    async (entry: BeadLibraryEntry) => {
      const updated = await beadsApi.updateLibrary(entry.id, entry);
      beadDetailHydratedRef.current.add(updated.id);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, updated),
      }));
      void refreshBuilderCatalogue();
      return updated;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const patchBeadLibrarySizes = useCallback(
    (libraryId: string, offers: BeadLibrarySizeOffer[]) => {
      mergeStore((prev) => ({
        ...prev,
        beadLibrarySizes: [
          ...prev.beadLibrarySizes.filter((o) => o.beadLibraryId !== libraryId),
          ...offers,
        ],
      }));
    },
    [mergeStore],
  );

  const saveBeadLibraryEntry = useCallback(
    async (
      entry: BeadLibraryEntry,
      sizes: BeadLibrarySizeInput[],
      options?: { initial?: BeadLibraryEntry; initialSizes?: BeadLibrarySizeInput[] },
    ) => {
      const diff = buildBeadSaveDiff(
        options?.initial,
        entry,
        sizes,
        options?.initialSizes ?? [],
      );

      if (Object.keys(diff.libraryPayload).length === 0 && !diff.sizesChanged) {
        return entry;
      }

      const result = await beadsApi.saveLibraryComplete(entry.id, {
        library: diff.libraryPayload,
        sizes: diff.sizesChanged ? diff.sizes : undefined,
      });

      mergeStore((prev) => {
        const beadLibraries = replaceById(prev.beadLibraries, result.library);
        let beadLibrarySizes = prev.beadLibrarySizes;
        if (result.sizes) {
          beadLibrarySizes = [
            ...prev.beadLibrarySizes.filter((o) => o.beadLibraryId !== entry.id),
            ...result.sizes,
          ];
        }
        const beadTags = [...prev.beadTags];
        for (const tag of result.library.tags ?? []) {
          if (!beadTags.some((t) => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase())) {
            beadTags.push(tag);
          }
        }
        beadTags.sort((a, b) => a.name.localeCompare(b.name));
        return { ...prev, beadLibraries, beadLibrarySizes, beadTags };
      });
      beadDetailHydratedRef.current.add(entry.id);

      if (result.cropChanged || result.sizesChanged) {
        void beadLibrarySizesApi.list(entry.id).then((offers) => {
          patchBeadLibrarySizes(entry.id, offers);
        });
      }

      void refreshBuilderCatalogue();
      return result.library;
    },
    [mergeStore, patchBeadLibrarySizes, refreshBuilderCatalogue],
  );

  const updateBeadCrop = useCallback(
    async (publicId: string, payload: Parameters<typeof beadsApi.updateCrop>[1]) => {
      const updated = await beadsApi.updateCrop(publicId, payload);
      beadDetailHydratedRef.current.add(publicId);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, updated),
      }));
      void refreshBuilderCatalogue();
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const deleteBeadLibrary = useCallback(
    async (id: string, options?: { force?: boolean }) => {
      await beadsApi.deleteLibrary(id, options);
      beadDetailHydratedRef.current.delete(id);
      const librarySizes = await beadLibrarySizesApi.list();
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: removeById(prev.beadLibraries, id),
        beadLibrarySizes: librarySizes,
      }));
      void refreshBuilderCatalogue();
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const getBeadLibraryReferences = useCallback(async (id: string) => {
    return beadsApi.getLibraryReferences(id);
  }, []);

  const recalculateBeadBoundsMetadata = useCallback(async () => {
    const result = await beadsApi.recalculateBoundsMetadata();
    const [beadLibraries, beadLibrarySizes, beadSizes] = await Promise.all([
      beadsApi.listLibraries(),
      beadLibrarySizesApi.list(),
      beadSizesApi.list(true),
    ]);
    mergeStore((prev) => ({ ...prev, beadLibraries, beadLibrarySizes, beadSizes }));
    void refreshBuilderCatalogue();
    return result;
  }, [mergeStore, refreshBuilderCatalogue]);

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
        enableSubTypes?: boolean;
        placementMode?: BeadTypeEntry["placementMode"];
        metadata?: BeadTypeEntry["metadata"];
      },
    ) => {
      const created = await beadsApi.createType(entry);
      const subBeadTypes = await subBeadTypesApi.list();
      mergeStore((prev) => ({
        ...prev,
        beadTypes: replaceById(prev.beadTypes, created),
        subBeadTypes,
      }));
      void refreshBuilderCatalogue();
      return created;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const updateBeadType = useCallback(
    async (entry: BeadTypeEntry) => {
      const updated = await beadsApi.updateType(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        beadTypes: replaceById(prev.beadTypes, updated),
      }));
      void refreshBuilderCatalogue();
      return updated;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const updateStrandRenderDefaults = useCallback(
    async (settings: import("@bino-foundry/shared/types").StrandRenderProfile) => {
      const saved = await settingsApi.updateStrandRenderDefaults(settings);
      mergeStore((prev) => ({ ...prev, strandRenderDefaults: saved }));
      return saved;
    },
    [mergeStore],
  );

  const deleteBeadType = useCallback(
    async (id: string) => {
      await beadsApi.deleteType(id);
      mergeStore((prev) => ({
        ...prev,
        beadTypes: removeById(prev.beadTypes, id),
        subBeadTypes: prev.subBeadTypes.filter((s) => s.beadTypeId !== id),
      }));
      void refreshBuilderCatalogue();
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const addSubBeadType = useCallback(
    async (
      entry: Pick<SubBeadTypeEntry, "beadTypeId" | "name" | "description"> & {
        displayOrder?: number;
        isActive?: boolean;
        metadata?: SubBeadTypeEntry["metadata"];
      },
    ) => {
      const created = await subBeadTypesApi.create(entry);
      mergeStore((prev) => ({
        ...prev,
        subBeadTypes: replaceById(prev.subBeadTypes, created),
      }));
      void refreshBuilderCatalogue();
      return created;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const updateSubBeadType = useCallback(
    async (entry: SubBeadTypeEntry) => {
      const updated = await subBeadTypesApi.update(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        subBeadTypes: replaceById(prev.subBeadTypes, updated),
      }));
      void refreshBuilderCatalogue();
      return updated;
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const deleteSubBeadType = useCallback(
    async (id: string) => {
      await subBeadTypesApi.delete(id);
      mergeStore((prev) => ({
        ...prev,
        subBeadTypes: removeById(prev.subBeadTypes, id),
      }));
      void refreshBuilderCatalogue();
    },
    [mergeStore, refreshBuilderCatalogue],
  );

  const addBeadSize = useCallback(
    async (entry: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">) => {
      const created = await beadSizesApi.create(entry);
      mergeStore((prev) => ({
        ...prev,
        beadSizes: replaceById(prev.beadSizes, created),
      }));
      return created;
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
      return updated;
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
      return created;
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
      return updated;
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

  const addHowWePrepareOption = useCallback(
    async (entry: Omit<HowWePrepareOption, "id" | "createdAt" | "updatedAt">) => {
      const created = await howWePrepareApi.create(entry);
      mergeStore((prev) => ({
        ...prev,
        howWePrepareOptions: replaceById(prev.howWePrepareOptions, created),
      }));
      return created;
    },
    [mergeStore],
  );

  const updateHowWePrepareOption = useCallback(
    async (entry: HowWePrepareOption) => {
      const updated = await howWePrepareApi.update(entry.id, entry);
      mergeStore((prev) => ({
        ...prev,
        howWePrepareOptions: replaceById(prev.howWePrepareOptions, updated),
      }));
      return updated;
    },
    [mergeStore],
  );

  const deleteHowWePrepareOption = useCallback(
    async (id: string) => {
      await howWePrepareApi.delete(id);
      mergeStore((prev) => ({
        ...prev,
        howWePrepareOptions: removeById(prev.howWePrepareOptions, id),
      }));
    },
    [mergeStore],
  );

  const addFrame = useCallback(
    async (entry: FrameEntry) => {
      const created = await catalogueApi.createFrame(entry);
      frameDetailHydratedRef.current.add(created.id);
      mergeStore((prev) => ({
        ...prev,
        frames: replaceById(prev.frames, created),
      }));
      return created;
    },
    [mergeStore],
  );

  const updateFrame = useCallback(
    async (entry: FrameEntry) => {
      const updated = await catalogueApi.updateFrame(entry.id, entry);
      frameDetailHydratedRef.current.add(updated.id);
      mergeStore((prev) => ({
        ...prev,
        frames: replaceById(prev.frames, updated),
      }));
      return updated;
    },
    [mergeStore],
  );

  const ensureFrameDetail = useCallback(
    async (id: string) => {
      if (frameDetailHydratedRef.current.has(id)) {
        const cached = storeRef.current.frames.find((f) => f.id === id);
        if (cached) return cached;
      }
      const full = await catalogueApi.getFrame(id);
      frameDetailHydratedRef.current.add(id);
      mergeStore((prev) => ({
        ...prev,
        frames: replaceById(prev.frames, full),
      }));
      return full;
    },
    [mergeStore],
  );

  const ensureBeadLibraryDetail = useCallback(
    async (id: string) => {
      if (beadDetailHydratedRef.current.has(id)) {
        const cached = storeRef.current.beadLibraries.find((b) => b.id === id);
        if (cached) return cached;
      }
      const full = await beadsApi.getLibrary(id);
      beadDetailHydratedRef.current.add(id);
      mergeStore((prev) => ({
        ...prev,
        beadLibraries: replaceById(prev.beadLibraries, full),
      }));
      return full;
    },
    [mergeStore],
  );

  const deleteFrame = useCallback(
    async (id: string, options?: { force?: boolean }) => {
      await catalogueApi.deleteFrame(id, options);
      frameDetailHydratedRef.current.delete(id);
      mergeStore((prev) => ({
        ...prev,
        frames: removeById(prev.frames, id),
      }));
    },
    [mergeStore],
  );

  const getFrameReferences = useCallback(async (id: string) => {
    return catalogueApi.getFrameReferences(id);
  }, []);

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
      saveBeadLibraryEntry,
      patchBeadLibrarySizes,
      updateBeadCrop,
      deleteBeadLibrary,
      getBeadLibraryReferences,
      recalculateBeadBoundsMetadata,
      recalculateMmGroupReferences,
      refreshBeadLibrarySizes,
      addBeadType,
      updateBeadType,
      updateStrandRenderDefaults,
      deleteBeadType,
      addSubBeadType,
      updateSubBeadType,
      deleteSubBeadType,
      addBeadSize,
      updateBeadSize,
      deleteBeadSize,
      addWristSize,
      updateWristSize,
      deleteWristSize,
      addHowWePrepareOption,
      updateHowWePrepareOption,
      deleteHowWePrepareOption,
      addFrame,
      updateFrame,
      ensureFrameDetail,
      ensureBeadLibraryDetail,
      deleteFrame,
      getFrameReferences,
      resetToDefaults,
      refreshFromApi,
    }),
    [
      store,
      isHydrating,
      hydrateError,
      addBeadLibrary,
      updateBeadLibrary,
      saveBeadLibraryEntry,
      patchBeadLibrarySizes,
      updateBeadCrop,
      deleteBeadLibrary,
      getBeadLibraryReferences,
      recalculateBeadBoundsMetadata,
      recalculateMmGroupReferences,
      refreshBeadLibrarySizes,
      addBeadType,
      updateBeadType,
      updateStrandRenderDefaults,
      deleteBeadType,
      addSubBeadType,
      updateSubBeadType,
      deleteSubBeadType,
      addBeadSize,
      updateBeadSize,
      deleteBeadSize,
      addWristSize,
      updateWristSize,
      deleteWristSize,
      addHowWePrepareOption,
      updateHowWePrepareOption,
      deleteHowWePrepareOption,
      addFrame,
      updateFrame,
      ensureFrameDetail,
      ensureBeadLibraryDetail,
      deleteFrame,
      getFrameReferences,
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
