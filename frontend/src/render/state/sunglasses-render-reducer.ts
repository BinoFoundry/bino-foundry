import type { BuilderOptionEntry, FrameColorEntry, LensTintEntry } from "@/types/sunglasses-catalog";

import { createDefaultRenderOptions } from "../engine/pricing";
import type { FrameColorSelection, SunglassesCompositorConfig, TintGradient } from "../types";

export type SunglassesRenderAction =
  | { type: "SET_FRAME"; frame: FrameColorSelection }
  | { type: "SET_TINT"; tint: TintGradient }
  | { type: "SET_OPTION"; code: string; enabled: boolean }
  | { type: "SET_OPTIONS"; options: Partial<Record<string, boolean>> }
  | { type: "SET_BASE_PRICE"; basePrice: number }
  | { type: "PATCH_CONFIG"; patch: Partial<SunglassesCompositorConfig> }
  | { type: "RESET"; basePrice?: number; builderOptions?: BuilderOptionEntry[]; defaultTint?: TintGradient; defaultFrame?: FrameColorSelection };

export interface InitialSunglassesCatalogSlice {
  builderOptions: BuilderOptionEntry[];
  defaultTint: TintGradient;
  defaultFrame: FrameColorSelection;
}

export function lensTintEntryToGradient(entry: LensTintEntry): TintGradient {
  return {
    name: entry.name,
    top: entry.gradientTop,
    bottom: entry.gradientBottom,
  };
}

export function frameColorEntryToSelection(entry: FrameColorEntry): FrameColorSelection {
  return { name: entry.name, hex: entry.hex };
}

export function createInitialSunglassesConfig(
  basePrice: number,
  catalog: InitialSunglassesCatalogSlice,
): SunglassesCompositorConfig {
  return {
    renderMode: "customiser-dynamic",
    basePrice,
    frame: catalog.defaultFrame,
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
    case "SET_FRAME":
      return { ...state, frame: action.frame };
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
        frame: { ...state.frame, ...action.patch.frame },
        tint: { ...state.tint, ...action.patch.tint },
        options: { ...state.options, ...action.patch.options },
        raster: action.patch.raster ?? state.raster,
      };
    case "RESET":
      if (action.builderOptions && action.defaultTint && action.defaultFrame) {
        return createInitialSunglassesConfig(action.basePrice ?? state.basePrice, {
          builderOptions: action.builderOptions,
          defaultTint: action.defaultTint,
          defaultFrame: action.defaultFrame,
        });
      }
      return {
        ...createInitialSunglassesConfig(state.basePrice, {
          builderOptions: [],
          defaultTint: state.tint,
          defaultFrame: state.frame,
        }),
        options: state.options,
      };
    default:
      return state;
  }
}
