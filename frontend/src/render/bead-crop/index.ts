export {
  beadVisualBoundsFromCropConfig,
  resolveBeadPhysicalMetrics,
  resolveBeadPhysicalMetricsAudit,
  resolveBeadPhysicalMetricsForRender,
  resolveBeadVisualBoundsNorm,
  clearBeadVisualBoundsCache,
  type BeadVisualBoundsNorm,
} from "./crop-visual-bounds";
export { computeBeadRenderSizingDebug, type BeadRenderSizingDebug } from "./bead-render-sizing";
export {
  isStrandBeadGeometryOverlayEnabled,
  normBBoxFromPoints,
  polygonAreaNorm,
  resolveBeadCropGeometryDebug,
  type BeadCropGeometryDebug,
} from "./crop-geometry-audit";
export {
  isRoundVisualBeadType,
  resolveBeadSlotSizing,
  type BeadClipBoundsPx,
  type BeadRenderSizingPath,
  type BeadSlotSizingCatalogueContext,
  type BeadSlotSizingResult,
  type SquareFallbackReason,
} from "./strand-bead-sizing";
export {
  resolveStrandRenderProfile,
  resolveStrandRenderProfileBySlug,
  resolveStrandRenderConfigForBead,
  resolveStrandRenderConfigForType,
  buildStrandRenderConfigCache,
  strandRenderCacheVersion,
  type ResolvedStrandRenderConfig,
  type StrandRenderCatalogueContext,
} from "./strand-render-profile";
export { useStrandRenderConfigCache } from "./use-strand-render-config-cache";
export { resolveBeadCropConfig } from "./resolve-bead-crop-config";
export { loadImage, loadImageForProcessing } from "./image-loader";
export {
  calibratedVisualDiameterPx,
  VISUAL_BEAD_BASE_PX,
  VISUAL_BEAD_MAX_PX,
  VISUAL_PX_PER_MM,
} from "./visual-bead-scale";
export {
  detectBeadOutline,
  detectBeadOutlineFromRgba,
  type DetectBeadOutlineOptions,
  type DetectBeadOutlineResult,
  type BeadOutlineDetectionMeta,
} from "./auto-detect-bead";
export { contourToBeadPathAnchors } from "./contour-to-bead-path";
export {
  beadCropConfigToEditorLenses,
  beadCropEditorPlateKey,
  beadCropPathToPreviewCanvas,
  defaultBeadCropLens,
  ensureBeadCropLens,
  editorLensesToBeadCropConfig,
  exportCroppedBeadBlob,
  exportCroppedBeadDeliveryBlobs,
  exportNormalizedBeadBlobs,
  deliveryUrlsFromUploads,
  computeProcessedExportDimensions,
  computeBeadPhysicalMetricsForSave,
  diagnoseNormalizedExport,
  exportBitmapComparison,
  isBeadCropEditorValid,
  measureCanvasVisibleFootprint,
  normalizedExportCanvasSidePx,
  upgradeBeadCropOnSave,
  type BitmapExportComparison,
  type NormalizedExportRenderDiagnosis,
  type CanvasVisibleFootprint,
} from "./crop-path";
export {
  beadCropClipPathStyles,
  beadCropObjectStyles,
  beadDisplayImageStyles,
  beadShapeClass,
  getBeadDisplayImageUrl,
  getBeadLibraryImageUrl,
  getBeadStrandImageUrl,
  getBeadImageUrlForVariant,
  resolveBeadDeliveryUrl,
  hasDistinctProcessedAsset,
  hasPreNormalizedStrandAsset,
  mergeSizeOfferFromCatalogue,
  resolvePreNormalizedDeliveryUrl,
} from "./apply-crop";
export {
  getBeadImageUrl,
  getBeadSlotDimensions,
  beadTargetDiameterPx,
  usesProcessedStrandAsset,
  buildStrandLoopPath,
  getGuideEmptySlotShellStyle,
  getGuideSlotDimensions,
  getPartialEmptySlotShellStyle,
  getEmptySlotShellStyle,
  getMaxSlotExtent,
  getBeadTangentArcPx,
  getPlacedBeadImageFilter,
  getPlacedBeadShellStyle,
  getStrandBeadImageStyle,
  getStrandBeadRasterSize,
  STRAND_CORD,
  mmToBasePx,
  STRAND_BEAD_VISUAL_SCALE,
  type BeadSlotDimensions,
} from "./strand-bead";
