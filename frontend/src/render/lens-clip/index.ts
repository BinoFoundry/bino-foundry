export {
  createLensClipConfig,
  isLensClipConfigValid,
  normalizeLensClipConfig,
  resolveFrameExclusionShapes,
  resolveLensExclusionShapes,
  LENS_CLIP_CONFIG_V1,
  type FrameExclusionShape,
  type LensClipConfig,
  type LensClipRenderSettings,
  type LensClipShape,
  type LensExclusionShape,
} from "@bino-foundry/shared/types";
export { lensClipConfigToMaskConfig, pathDToLensPolygon } from "./clip-to-mask";
export { maskConfigToLensClipConfig } from "./mask-to-clip";
export { editorPlateKey, resolveMaskConfigForEditor } from "./mask-for-editor";
export { resolveLensClipConfig, isFrameViewClipReady } from "./resolve-clip";
export {
  DEFAULT_LENS_CLIP_RENDER,
  resolveLensClipRenderSettings,
  type ResolvedLensClipRender,
} from "./clip-settings";
export {
  resolveGlassMaterialFilterParams,
  resolveAppliedGlassBaseDensity,
  resolveBaseGlassDarknessAmount,
  resolveBaseGlassRichnessAmount,
  resolveSourceChromaRetain,
  resolveReflectionTransformForSide,
  resolveReflectionAppearanceForSide,
  resolveLensReflectionSide,
  approximatePathBounds,
  type GlassMaterialFilterParams,
  type LensReflectionSide,
} from "./glass-material-filter";
export {
  resolvePrototypeGlassAppearance,
  type PrototypeGlassAppearance,
} from "./prototype-glass-appearance";
export { PrototypeGlassElement } from "./PrototypeGlassElement";
export { GlassMaterialFilterDef } from "./GlassMaterialFilterDef";
export {
  applyLensRenderHierarchyToFrameViews,
  buildSparseFrameRenderOverride,
  frameLensRenderSource,
  resolveAssignedLensRenderPreset,
  resolveFrameLensRenderSettings,
  withResolvedLensRender,
} from "./lens-render-hierarchy";
export { lensPolygonToPathD, lensesToClipShapes } from "./svg-path-builder";
