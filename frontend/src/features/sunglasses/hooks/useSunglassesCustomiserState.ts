import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isCatalogItemVisibleInBuilder } from "@/features/catalog-lifecycle/visibility";
import { AssetLoader } from "@/render/assets/asset-loader";
import { buildCustomiserCompositorConfig } from "@/render/adapters/customiser-config";
import { calculateSunglassesTotal, formatConfigSummary } from "@/render/engine/pricing";
import { lensTintEntryToGradient } from "@/render/state/sunglasses-render-reducer";
import { useSunglassesRenderState } from "@/render/hooks/useSunglassesRenderState";
import { useCatalogue } from "@/state/catalogue";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";
import type { FrameOption } from "@/lib/luxe-data";
import { FRAME_BASE_PRICE } from "@/lib/luxe-data";

import { loadCustomiserSession, saveCustomiserSession } from "../utils/customiser-session";
import { resolveLoadedSunglassesFrame } from "../load-saved-sunglasses";
import { isUnavailableFrame } from "../unavailable-frame";

const EMPTY_FRAME: FrameOption = {
  id: "fallback",
  name: "Standard Frame",
  description: "",
  frameImages: [],
  price: FRAME_BASE_PRICE,
  lensColors: [],
};

const plateLoader = new AssetLoader();

export function useSunglassesCustomiserState(onPriceChange?: (price: number) => void) {
  const { frames: allFrames, catalogAvailabilityStatuses } = useCatalogue();
  const sunglassesCatalog = useSunglassesCatalog();
  const sessionHydrated = useRef(false);

  const statusByCode = useMemo(
    () => new Map(catalogAvailabilityStatuses.map((s) => [s.code, s])),
    [catalogAvailabilityStatuses],
  );

  const builderFrames = useMemo(
    () =>
      allFrames.filter((f) =>
        isCatalogItemVisibleInBuilder(f.availabilityStatusCode, f.isActive, statusByCode),
      ),
    [allFrames, statusByCode],
  );

  const [frameSkuId, setFrameSkuId] = useState<string>("");
  const [loadedFrameOverride, setLoadedFrameOverride] = useState<FrameOption | null>(null);
  const [frameCatalogIssue, setFrameCatalogIssue] = useState<"deleted" | "unavailable" | null>(
    null,
  );

  const [selectedTintId, setSelectedTintId] = useState<string | null>(null);

  const frameSku = useMemo(() => {
    if (loadedFrameOverride) return loadedFrameOverride;
    if (!allFrames.length && !builderFrames.length) return EMPTY_FRAME;
    const match = allFrames.find((f) => f.id === frameSkuId) ?? builderFrames.find((f) => f.id === frameSkuId);
    return match ?? builderFrames[0] ?? EMPTY_FRAME;
  }, [allFrames, builderFrames, frameSkuId, loadedFrameOverride]);

  const hasUnavailableFrame =
    frameCatalogIssue != null || isUnavailableFrame(frameSku);

  const selectedTintEntry = useMemo(() => {
    if (!sunglassesCatalog.lensTints.length) return null;
    if (selectedTintId) {
      const found = sunglassesCatalog.getTintById(selectedTintId);
      if (found) return found;
    }
    return sunglassesCatalog.lensTints[0];
  }, [selectedTintId, sunglassesCatalog]);

  const catalogSlice = useMemo(() => {
    const defaultTint = sunglassesCatalog.lensTints[0];
    return {
      builderOptions: sunglassesCatalog.builderOptions,
      defaultTint: defaultTint
        ? lensTintEntryToGradient(defaultTint)
        : { name: "Default", top: "#4a5568", bottom: "#2d3748" },
    };
  }, [sunglassesCatalog.builderOptions, sunglassesCatalog.lensTints]);

  const render = useSunglassesRenderState({
    basePrice: frameSku.price ?? FRAME_BASE_PRICE,
    catalog: catalogSlice,
    builderOptions: sunglassesCatalog.builderOptions,
    selectedTintEntry,
    frameLabel: frameSku.name,
  });

  useEffect(() => {
    if (sessionHydrated.current || !builderFrames.length || !sunglassesCatalog.lensTints.length) {
      return;
    }
    const saved = loadCustomiserSession();
    if (saved?.frameSkuId) {
      const resolved = resolveLoadedSunglassesFrame({
        savedFrameId: saved.frameSkuId,
        allFrames,
      });
      setFrameSkuId(resolved.frameId);
      if (isUnavailableFrame(resolved.frame)) {
        setLoadedFrameOverride(resolved.frame);
      }
    } else {
      setFrameSkuId(builderFrames[0].id);
    }
    if (saved?.selectedTintId && sunglassesCatalog.getTintById(saved.selectedTintId)) {
      setSelectedTintId(saved.selectedTintId);
    } else {
      setSelectedTintId(sunglassesCatalog.lensTints[0]?.id ?? null);
    }
    if (saved?.options) {
      render.dispatch({ type: "SET_OPTIONS", options: saved.options });
    }
    sessionHydrated.current = true;
  }, [builderFrames, allFrames, sunglassesCatalog, render.dispatch]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    if (!frameSkuId && builderFrames.length) {
      setFrameSkuId(builderFrames[0].id);
    }
  }, [builderFrames, frameSkuId]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    if (!selectedTintId && sunglassesCatalog.lensTints.length) {
      setSelectedTintId(sunglassesCatalog.lensTints[0].id);
    }
  }, [sunglassesCatalog.lensTints, selectedTintId]);

  useEffect(() => {
    render.patchConfig({ basePrice: frameSku.price ?? FRAME_BASE_PRICE, frameLabel: frameSku.name });
  }, [frameSku.name, frameSku.price, render.patchConfig]);

  useEffect(() => {
    if (selectedTintEntry) {
      render.setTint(lensTintEntryToGradient(selectedTintEntry));
    }
  }, [selectedTintEntry, render.setTint]);

  useEffect(() => {
    if (!sessionHydrated.current || !frameSkuId) return;
    saveCustomiserSession({
      frameSkuId,
      selectedTintId,
      options: render.config.options,
    });
  }, [frameSkuId, selectedTintId, render.config.options]);

  useEffect(() => {
    const urls =
      frameSku.renderViews
        ?.filter((v) => v.plateUrl?.trim())
        .map((v) => v.plateUrl) ?? [];
    void plateLoader.preloadMany(urls);
  }, [frameSku.id, frameSku.renderViews]);

  const compositorConfig = useMemo(
    () =>
      buildCustomiserCompositorConfig({
        frameSku,
        tint: render.config.tint,
        options: render.config.options,
      }),
    [frameSku, render.config.tint, render.config.options],
  );

  const totalPrice = useMemo(
    () =>
      calculateSunglassesTotal(
        frameSku.price ?? FRAME_BASE_PRICE,
        render.config.options,
        sunglassesCatalog.builderOptions,
        selectedTintEntry,
      ),
    [frameSku.price, render.config.options, sunglassesCatalog.builderOptions, selectedTintEntry],
  );

  const summaryText = useMemo(
    () => formatConfigSummary(frameSku.name, render.config.tint.name),
    [frameSku.name, render.config.tint.name],
  );

  useEffect(() => {
    onPriceChange?.(totalPrice);
  }, [totalPrice, onPriceChange]);

  const selectFrameSku = useCallback(
    (id: string) => {
      setFrameSkuId(id);
      setLoadedFrameOverride(null);
      setFrameCatalogIssue(null);
    },
    [],
  );

  const applyLoadedFrame = useCallback(
    (savedFrameId: string, catalogIssue?: "deleted" | "unavailable" | null) => {
      const resolved = resolveLoadedSunglassesFrame({
        savedFrameId,
        catalogIssue,
        allFrames,
      });
      setFrameSkuId(resolved.frameId);
      setFrameCatalogIssue(
        catalogIssue ?? (resolved.hasCatalogIssue ? (isUnavailableFrame(resolved.frame) ? "deleted" : "unavailable") : null),
      );
      if (isUnavailableFrame(resolved.frame)) {
        setLoadedFrameOverride(resolved.frame);
      } else {
        setLoadedFrameOverride(null);
      }
    },
    [allFrames],
  );

  const selectTintById = useCallback((tintId: string) => {
    setSelectedTintId(tintId);
  }, []);

  return {
    frames: builderFrames,
    allFrames,
    frameSku,
    hasUnavailableFrame,
    selectFrameSku,
    applyLoadedFrame,
    compositorConfig,
    totalPrice,
    summaryText,
    selectTintById,
    activeTintId: selectedTintEntry?.id ?? null,
    selectedTintEntry,
    sunglassesCatalog,
    requiresManualFollowUp: render.requiresManualFollowUp,
    ...render,
  };
}
