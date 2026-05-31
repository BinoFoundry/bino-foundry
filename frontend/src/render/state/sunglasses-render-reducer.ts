import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import { createDefaultRenderOptions } from "../engine/pricing";
import type { SunglassesCompositorConfig, TintGradient } from "../types";

export type SunglassesRenderAction =
  | { type: "SET_TINT"; tint: TintGradient }
  | { type: "SET_OPTION"; code: string; enabled: boolean }
  | { type: "SET_OPTIONS"; options: Partial<Record<string, boolean>> }
  | { type: "SET_BASE_PRICE"; basePrice: number }
  | { type: "PATCH_CONFIG"; patch: Partial<SunglassesCompositorConfig> }
  | {
      type: "RESET";
      basePrice?: number;
      builderOptions?: BuilderOptionEntry[];
      defaultTint?: TintGradient;
      frameLabel?: string;
    };

export interface InitialSunglassesCatalogSlice {
  builderOptions: BuilderOptionEntry[];
  defaultTint: TintGradient;
  frameLabel?: string;
}

export { lensTintEntryToGradient } from "../tint/lens-tint-spec";

export function createInitialSunglassesConfig(
  basePrice: number,
  catalog: InitialSunglassesCatalogSlice,
): SunglassesCompositorConfig {
  return {
    renderMode: "customiser-dynamic",
    basePrice,
    frameLabel: catalog.frameLabel,
    tint: catalog.defaultTint,
    options: createDefaultRenderOptions(catalog.builderOptions),
    raster: undefined,
  };
}

export function sunglassesRenderReducer(
  state: SunglassesCompositorConfig,
  action: SunglassesRenderAction,
): SunglassesCompositorConfig {
  switch (action.type) {
    case "SET_TINT":
      return { ...state, tint: action.tint };
    case "SET_OPTION":
      return {
        ...state,
        options: { ...state.options, [action.code]: action.enabled },
      };
    case "SET_OPTIONS":
      return { ...state, options: { ...state.options, ...action.options } };
    case "SET_BASE_PRICE":
      return { ...state, basePrice: action.basePrice };
    case "PATCH_CONFIG":
      return {
        ...state,
        ...action.patch,
        tint: { ...state.tint, ...action.patch.tint },
        options: { ...state.options, ...action.patch.options },
        raster: action.patch.raster ?? state.raster,
      };
    case "RESET":
      if (action.builderOptions && action.defaultTint) {
        return createInitialSunglassesConfig(action.basePrice ?? state.basePrice, {
          builderOptions: action.builderOptions,
          defaultTint: action.defaultTint,
          frameLabel: action.frameLabel ?? state.frameLabel,
        });
      }
      return {
        ...createInitialSunglassesConfig(state.basePrice, {
          builderOptions: [],
          defaultTint: state.tint,
          frameLabel: state.frameLabel,
        }),
        options: state.options,
      };
    default:
      return state;
  }
}
