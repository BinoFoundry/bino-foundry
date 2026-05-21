export {
  applyPolygonMaskToAsset,
  loadPlateForRendering,
  type MaskedAssetLayers,
  type RenderablePlateAsset,
} from "./apply-mask";
export { PolygonEditor } from "./PolygonEditor";
export { EditorTool } from "./editor-interaction";
export {
  createMaskConfig,
  defaultLensSet,
  isMaskConfigValid,
  migrateAnchors,
  MASK_CONFIG_VERSION,
  type LensPolygon,
  type MaskConfig,
  type PathAnchor,
} from "./mask-types";
export { pathsToMaskCanvas } from "./bezier-path";
export { buildLayersFromSource, detectLensMask } from "./auto-lens-mask";
