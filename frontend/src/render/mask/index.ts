export {
  applyPolygonMaskToAsset,
  loadPlateForRendering,
  type MaskedAssetLayers,
  type RenderablePlateAsset,
} from "./apply-mask";
export { PolygonEditor } from "./PolygonEditor";
export { EditorTool } from "./editor-interaction";
export {
  createLensPolygon,
  createMaskConfig,
  defaultLensSet,
  ensureFrameLensSet,
  isMaskConfigValid,
  migrateAnchors,
  MASK_CONFIG_VERSION,
  type LensPolygon,
  type MaskConfig,
  type PathAnchor,
} from "./mask-types";
export { pathsToMaskCanvas } from "./bezier-path";
export { buildLayersFromSource, detectLensMask, detectLensMaskBitmap, floodFromBorderThroughOpen, splitMergedLensBridge } from "./auto-lens-mask";
export {
  detectFrameLensMaskFromSource,
  detectFrameLensMaskFromUrl,
  detectFrameLensSideFromSource,
  detectFrameLensSideFromUrl,
  assignAnchorsByCentroidX,
  estimateLensPolygonsFromGeometry,
  isDualLensMaskValid,
  isLensSideValid,
  hasAnyLensMask,
  mergeLensSideIntoMask,
  LENS_AUTO_DETECT_FAILED_MESSAGE,
  LENS_DUAL_DETECT_FAILED_MESSAGE,
  LENS_SIDE_DETECT_FAILED,
  LENS_SIDE_LABELS,
  type AutoDetectLensResult,
  type DetectLensSideResult,
  type FrameLensSide,
} from "./auto-detect-frame-lenses";
