import type { BeadCropMetricsSource } from "@bino-foundry/shared/types";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";

import { resolveBeadPhysicalMetricsAudit } from "./crop-visual-bounds";
import {
  resolveBeadSlotSizing,
  type BeadRenderSizingPath,
  type BeadSlotSizingCatalogueContext,
  type SquareFallbackReason,
} from "./strand-bead-sizing";
import type { BeadCropGeometryDebug } from "./crop-geometry-audit";

export interface BeadRenderSizingDebug {
  sizeMm: number;
  configuredSizeMm: number;
  targetDiameterPx: number;
  visibleDiameterPx: number | null;
  assetVisibleDiameterPx: number | null;
  anchorEstimateDiameterPx: number | null;
  calculatedScale: number | null;
  finalAppliedScale: number | null;
  wrapperWidthPx: number;
  wrapperHeightPx: number;
  wrapperDiameterPx: number;
  finalRenderWidthPx: number;
  finalRenderHeightPx: number;
  imageRenderWidthPx: number;
  imageRenderHeightPx: number;
  actualVisibleDiameterPx: number | null;
  layoutAspectRatio: number;
  isRoundVisualBead: boolean;
  visibleContentWidthPx: number | null;
  visibleContentHeightPx: number | null;
  visibleContentDiameterPx: number | null;
  visualSilhouetteDiameterPx: number | null;
  exportFillRatio: number | null;
  processedMaxPx: number | null;
  metricsSource: BeadCropMetricsSource | "missing";
  renderMetricsSource: BeadCropMetricsSource | BeadRenderSizingPath | "missing";
  sizingPath: BeadRenderSizingPath;
  normalizationActive: boolean;
  normalizationSource: BeadCropMetricsSource | "processedImage" | "none";
  normalizationScale: number | null;
  mmGroupNormalizationFactor: number;
  mmGroupActive: boolean;
  baseTargetDiameterPx: number;
  groupReferenceDiameterPx: number | null;
  squareFallbackReason: SquareFallbackReason | null;
  cropConfigPresent: boolean;
  usesProcessedCanvas: boolean;
  usesClipPath: boolean;
  objectFit: string;
  metadataMismatch: boolean;
  occupancyRatio: number;
  polygonBoundingWidthPx: number | null;
  polygonBoundingHeightPx: number | null;
  polygonDiameterPx: number | null;
  imageRenderScale: number | null;
  cropGeometry: BeadCropGeometryDebug;
}

export function computeBeadRenderSizingDebug(
  bead: BeadLibraryEntry,
  sizeMm: BeadSize,
  scaleFactor = 1,
  options?: {
    catalogue?: BeadSlotSizingCatalogueContext;
    normalizationFactor?: number;
  },
): BeadRenderSizingDebug {
  const catalogueOffer = options?.catalogue?.beadLibrarySizes?.find(
    (o) => o.beadLibraryId === bead.id && o.sizeMm === sizeMm,
  );
  const placed: PlacedBead = {
    position: 0,
    size: {
      offerKey: catalogueOffer?.offerKey ?? "k",
      sizeMm,
      label: `${sizeMm} mm`,
      unitPrice: catalogueOffer?.unitPrice ?? 1,
      normalizationFactor: options?.normalizationFactor ?? catalogueOffer?.normalizationFactor,
      assetVisibleDiameterPx: catalogueOffer?.assetVisibleDiameterPx ?? undefined,
    },
    bead,
  };
  const sizing = resolveBeadSlotSizing(placed, sizeMm, scaleFactor, options?.catalogue);
  const auditResolution = resolveBeadPhysicalMetricsAudit(bead);

  const anchorEstimateDiameterPx =
    auditResolution?.source === "anchorEstimate" && auditResolution.metrics
      ? Math.max(
          auditResolution.metrics.visibleWidthPx,
          auditResolution.metrics.visibleHeightPx,
          auditResolution.metrics.referenceDiameterPx,
        )
      : null;

  const renderMetrics = sizing.renderResolution?.metrics ?? null;
  const renderVisible =
    renderMetrics != null
      ? renderMetrics.visibleDiameterPx ?? renderMetrics.referenceDiameterPx
      : null;

  const metadataMismatch = Boolean(
    auditResolution?.source === "anchorEstimate" &&
      sizing.renderResolution?.source === "physicalMetrics" &&
      anchorEstimateDiameterPx != null &&
      renderVisible != null &&
      Math.abs(anchorEstimateDiameterPx - renderVisible) / renderVisible > 0.05,
  );

  const processedMaxPx =
    renderMetrics?.processedWidthPx && renderMetrics?.processedHeightPx
      ? Math.max(renderMetrics.processedWidthPx, renderMetrics.processedHeightPx)
      : null;

  return {
    sizeMm,
    configuredSizeMm: sizing.configuredSizeMm,
    baseTargetDiameterPx: sizing.baseTargetDiameterPx,
    targetDiameterPx: sizing.targetDiameterPx,
    mmGroupNormalizationFactor: sizing.mmGroupNormalizationFactor,
    mmGroupActive: sizing.mmGroupActive,
    groupReferenceDiameterPx: sizing.groupReferenceDiameterPx,
    assetVisibleDiameterPx: sizing.assetVisibleDiameterPx,
    visibleDiameterPx: renderVisible,
    anchorEstimateDiameterPx,
    calculatedScale: sizing.appliedScale,
    finalAppliedScale: sizing.finalAppliedScale,
    wrapperWidthPx: sizing.dimensions.width,
    wrapperHeightPx: sizing.dimensions.height,
    wrapperDiameterPx: sizing.wrapperDiameterPx,
    finalRenderWidthPx: sizing.finalRenderWidthPx,
    finalRenderHeightPx: sizing.finalRenderHeightPx,
    imageRenderWidthPx: sizing.imageRenderWidthPx,
    imageRenderHeightPx: sizing.imageRenderHeightPx,
    actualVisibleDiameterPx: sizing.actualVisibleDiameterPx,
    layoutAspectRatio: sizing.layoutAspectRatio,
    isRoundVisualBead: sizing.isRoundVisualBead,
    visibleContentWidthPx: sizing.visibleContentWidthPx,
    visibleContentHeightPx: sizing.visibleContentHeightPx,
    visibleContentDiameterPx: sizing.visibleContentDiameterPx,
    visualSilhouetteDiameterPx: sizing.visibleContentDiameterPx,
    exportFillRatio: sizing.exportFillRatio,
    processedMaxPx,
    metricsSource: auditResolution?.source ?? "missing",
    renderMetricsSource: sizing.normalizationActive
      ? sizing.sizingPath
      : (sizing.renderResolution?.source ?? "missing"),
    sizingPath: sizing.sizingPath,
    normalizationActive: sizing.normalizationActive,
    normalizationSource: sizing.normalizationSource,
    normalizationScale: sizing.normalizationScale,
    squareFallbackReason: sizing.squareFallbackReason,
    cropConfigPresent: sizing.cropConfigPresent,
    usesProcessedCanvas: sizing.usesProcessedCanvas,
    usesClipPath: sizing.usesClipPath,
    objectFit: sizing.objectFit ?? "fill",
    metadataMismatch,
    imageRenderScale: sizing.imageRenderScale,
    occupancyRatio: sizing.occupancyRatio,
    polygonBoundingWidthPx: sizing.polygonBoundingWidthPx,
    polygonBoundingHeightPx: sizing.polygonBoundingHeightPx,
    polygonDiameterPx: sizing.polygonDiameterPx,
    cropGeometry: sizing.cropGeometry,
  };
}
