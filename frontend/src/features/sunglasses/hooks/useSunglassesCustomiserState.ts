import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const { frames: allFrames } = useCatalogue();
  const sunglassesCatalog = useSunglassesCatalog();
  const sessionHydrated = useRef(false);

  const frames = useMemo(
    () => allFrames.filter((f) => f.isActive !== false),
    [allFrames],
  );

  const [frameSkuId, setFrameSkuId] = useState<string>("");
  const [selectedTintId, setSelectedTintId] = useState<string | null>(null);

  const frameSku = useMemo(() => {
    if (!frames.length) return EMPTY_FRAME;
    return frames.find((f) => f.id === frameSkuId) ?? frames[0];
  }, [frames, frameSkuId]);

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
    if (sessionHydrated.current || !frames.length || !sunglassesCatalog.lensTints.length) return;
    const saved = loadCustomiserSession();
    if (saved?.frameSkuId && frames.some((f) => f.id === saved.frameSkuId)) {
      setFrameSkuId(saved.frameSkuId);
    } else {
      setFrameSkuId(frames[0].id);
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
  }, [frames, sunglassesCatalog, render.dispatch]);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    if (!frameSkuId && frames.length) {
      setFrameSkuId(frames[0].id);
    }
  }, [frames, frameSkuId]);

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

  const selectFrameSku = useCallback((id: string) => {
    setFrameSkuId(id);
  }, []);

  const selectTintById = useCallback((tintId: string) => {
    setSelectedTintId(tintId);
  }, []);

  return {
    frames,
    frameSku,
    selectFrameSku,
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
