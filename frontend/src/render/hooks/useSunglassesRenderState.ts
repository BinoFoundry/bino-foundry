import { useCallback, useMemo, useReducer } from "react";

import type { BuilderOptionEntry, FrameColorEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import {
  calculateSunglassesTotal,
  formatConfigSummary,
  hasManualFollowUpSelected,
} from "../engine/pricing";
import {
  createInitialSunglassesConfig,
  frameColorEntryToSelection,
  lensTintEntryToGradient,
  sunglassesRenderReducer,
  type InitialSunglassesCatalogSlice,
  type SunglassesRenderAction,
} from "../state/sunglasses-render-reducer";
import type { FrameColorSelection, SunglassesCompositorConfig, TintGradient } from "../types";

export interface UseSunglassesRenderStateArgs {
  basePrice: number;
  catalog: InitialSunglassesCatalogSlice;
  builderOptions: BuilderOptionEntry[];
  selectedTintEntry?: LensTintEntry | null;
}

export function useSunglassesRenderState({
  basePrice,
  catalog,
  builderOptions,
  selectedTintEntry,
}: UseSunglassesRenderStateArgs) {
  const [config, dispatch] = useReducer(
    sunglassesRenderReducer,
    { basePrice, catalog },
    ({ basePrice: bp, catalog: cat }) => createInitialSunglassesConfig(bp, cat),
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
    () => formatConfigSummary(config.frame.name, config.tint.name),
    [config.frame.name, config.tint.name],
  );

  const setFrame = useCallback((frame: FrameColorSelection) => {
    dispatch({ type: "SET_FRAME", frame });
  }, []);

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
      defaultFrame?: FrameColorEntry;
    }) => {
      dispatch({
        type: "RESET",
        basePrice: next?.basePrice,
        builderOptions: next?.builderOptions,
        defaultTint: next?.defaultTint ? lensTintEntryToGradient(next.defaultTint) : undefined,
        defaultFrame: next?.defaultFrame
          ? frameColorEntryToSelection(next.defaultFrame)
          : undefined,
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
    setFrame,
    setTint,
    setOption,
    isOptionEnabled,
    patchConfig,
    reset,
  };
}
