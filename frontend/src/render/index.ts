export { buildCompositorConfigFromCatalogue, type CatalogueLensColor } from "./adapters/catalogue-adapter";
export { SunglassesCompositor, CompositorViewport } from "./components";
export { LAYER_Z_INDEX } from "./constants";
export { buildCompositorStack, calculateSunglassesTotal, formatConfigSummary } from "./engine";
export { createRenderEngineFacade, createPlaceholderRenderFacade } from "./facade";
export { useCompositor, useSunglassesRenderState } from "./hooks";
export { LayerStack } from "./layers";
export { RenderProvider, useRenderFacade } from "./RenderProvider";
export { TINT_PRESETS, FRAME_COLOR_PRESETS, DEFAULT_TINT } from "./tint";
export type {
  CompositorLayerSpec,
  CompositorStack,
  CompositorView,
  RenderComposition,
  RenderFacade,
  RenderLayerDescriptor,
  RenderLayerKind,
  SunglassesCompositorConfig,
  TintGradient,
} from "./types";
