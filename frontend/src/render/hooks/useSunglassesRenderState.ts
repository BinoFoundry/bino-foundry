import { useCallback, useMemo, useReducer } from "react";

import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import {
  calculateSunglassesTotal,
  formatConfigSummary,
  hasManualFollowUpSelected,
} from "../engine/pricing";
import {
  createInitialSunglassesConfig,
  lensTintEntryToGradient,
  sunglassesRenderReducer,
  type InitialSunglassesCatalogSlice,
  type SunglassesRenderAction,
} from "../state/sunglasses-render-reducer";
import type { SunglassesCompositorConfig, TintGradient } from "../types";

export interface UseSunglassesRenderStateArgs {
  basePrice: number;
  catalog: InitialSunglassesCatalogSlice;
  builderOptions: BuilderOptionEntry[];
  selectedTintEntry?: LensTintEntry | null;
  frameLabel?: string;
}

export function useSunglassesRenderState({
  basePrice,
  catalog,
  builderOptions,
  selectedTintEntry,
  frameLabel,
}: UseSunglassesRenderStateArgs) {
  const [config, dispatch] = useReducer(
    sunglassesRenderReducer,
    { basePrice, catalog, frameLabel },
    ({ basePrice: bp, catalog: cat, frameLabel: label }) =>
      createInitialSunglassesConfig(bp, { ...cat, frameLabel: label ?? cat.frameLabel }),
  );

  const totalPrice = useMemo(
    () =>
      calculateSunglassesTotal(
        config.basePrice,
        config.options,
        builderOptions,
        selectedTintEntry,
      ),
    [config.basePrice, config.options, builderOptions, selectedTintEntry],
  );

  const requiresManualFollowUp = useMemo(
    () => hasManualFollowUpSelected(config.options, builderOptions),
    [config.options, builderOptions],
  );

  const summaryText = useMemo(
    () => formatConfigSummary(frameLabel ?? "Frame", config.tint.name),
    [frameLabel, config.tint.name],
  );

  const setTint = useCallback((tint: TintGradient) => {
    dispatch({ type: "SET_TINT", tint });
  }, []);

  const setOption = useCallback((code: string, enabled: boolean) => {
    dispatch({ type: "SET_OPTION", code, enabled });
  }, []);

  const isOptionEnabled = useCallback(
    (code: string) => Boolean(config.options[code]),
    [config.options],
  );

  const patchConfig = useCallback((patch: Partial<SunglassesCompositorConfig>) => {
    dispatch({ type: "PATCH_CONFIG", patch });
  }, []);

  const reset = useCallback(
    (next?: {
      basePrice?: number;
      builderOptions?: BuilderOptionEntry[];
      defaultTint?: LensTintEntry;
      frameLabel?: string;
    }) => {
      dispatch({
        type: "RESET",
        basePrice: next?.basePrice,
        builderOptions: next?.builderOptions,
        defaultTint: next?.defaultTint ? lensTintEntryToGradient(next.defaultTint) : undefined,
        frameLabel: next?.frameLabel,
      });
    },
    [],
  );

  const act = useCallback((action: SunglassesRenderAction) => dispatch(action), []);

  return {
    config,
    dispatch: act,
    totalPrice,
    summaryText,
    requiresManualFollowUp,
    setTint,
    setOption,
    isOptionEnabled,
    patchConfig,
    reset,
  };
}
