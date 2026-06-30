import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadTypeEntry } from "@/types/beads";
import type { BeadCropMetricsResolution, BeadCropMetricsSource } from "@bino-foundry/shared/types";

import {
  hasDistinctProcessedAsset,
  hasPreNormalizedStrandAsset,
  beadCropClipPathStyles,
  mergeSizeOfferFromCatalogue,
} from "./apply-crop";
import { resolveBeadCropConfig } from "./resolve-bead-crop-config";
import { calibratedVisualDiameterPx } from "./visual-bead-scale";
import { resolveStrandRenderProfile } from "./strand-render-profile";

export interface BeadSlotDimensions {
  width: number;
  height: number;
}

export interface BeadSlotSizingCatalogueContext extends StrandRenderCatalogueContext {
  beadSizes?: BeadSizeEntry[];
  beadLibrarySizes?: BeadLibrarySizeOffer[];
  beadTypes?: BeadTypeEntry[];
}

function mmToBasePx(sizeMm: number, scaleFactor: number): number {
  return calibratedVisualDiameterPx(sizeMm) * scaleFactor;
}

export type BeadRenderSizingPath =
  | "normalizedVisibleDiameter"
  | "visualBoundsNormalized"
  | "anchorVisibleDiameter"
  | "processedImageNormalized"
  | "visualBoundsSlotFallback"
  | "squareTargetFallback";

export type SquareFallbackReason =
  | "noBead"
  | "noCropConfig"
  | "noMetrics"
  | "footprintFailed";

export interface BeadClipBoundsPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BeadSlotOffsetPx {
  left: number;
  top: number;
}

export interface BeadSlotSizingResult {
  dimensions: BeadSlotDimensions;
  imageDimensions: BeadSlotDimensions;
  imageOffsetPx: BeadSlotOffsetPx;
  sizingPath: BeadRenderSizingPath;
  configuredSizeMm: number;
  baseTargetDiameterPx: number;
  assetVisibleDiameterPx: number | null;
  groupReferenceDiameterPx: number | null;
  mmGroupNormalizationFactor: number;
  mmGroupActive: boolean;
  targetDiameterPx: number;
  appliedScale: number | null;
  finalAppliedScale: number | null;
  normalizationActive: boolean;
  normalizationSource: BeadCropMetricsSource | "processedImage" | "none";
  normalizationScale: number | null;
  squareFallbackReason: SquareFallbackReason | null;
  cropConfigPresent: boolean;
  renderResolution: BeadCropMetricsResolution | null;
  usesProcessedCanvas: boolean;
  isRoundVisualBead: boolean;
  /** Omit object-fit in CSS — bitmap is authoritative. */
  objectFit: CSSProperties["objectFit"] | null;
  usesClipPath: boolean;
  wrapperDiameterPx: number;
  visibleContentWidthPx: number | null;
  visibleContentHeightPx: number | null;
  visibleContentDiameterPx: number | null;
  actualVisibleDiameterPx: number | null;
  layoutAspectRatio: number;
  finalRenderWidthPx: number;
  finalRenderHeightPx: number;
  imageRenderWidthPx: number;
  imageRenderHeightPx: number;
  clipPathBoundsPx: BeadClipBoundsPx | null;
  exportFillRatio: number | null;
  occupancyRatio: number;
  polygonBoundingWidthPx: number | null;
  polygonBoundingHeightPx: number | null;
  polygonDiameterPx: number | null;
  imageRenderScale: number | null;
  cropGeometry: BeadCropGeometryDebug;
}

const TYPE_FOOTPRINT: Record<string, { width: number; height: number }> = {
  crystal: { width: 1, height: 1 },
  gemstone: { width: 1, height: 1 },
  accent: { width: 1, height: 1 },
  "round-bead": { width: 1, height: 1 },
  connector: { width: 1, height: 1 },
  separator: { width: 1, height: 1 },
  charm: { width: 1, height: 1 },
  spacer: { width: 1, height: 1 },
};

export function isRoundVisualBeadType(
  slug: string | undefined | null,
  catalogue?: StrandRenderCatalogueContext,
  bead?: BeadLibraryEntry | null,
): boolean {
  return resolveStrandRenderProfile(bead ?? null, catalogue).forceRoundFootprint;
}

function finalizeLayoutFootprint(
  footprint: BeadSlotDimensions,
  forceRound: boolean,
): BeadSlotDimensions {
  if (!forceRound) return footprint;
  const d = Math.max(footprint.width, footprint.height);
  return { width: d, height: d };
}

function typeScaleFor(bead: BeadLibraryEntry | null | undefined, catalogue?: StrandRenderCatalogueContext) {
  const profile = resolveStrandRenderProfile(bead ?? null, catalogue);
  const meta = strandScaleMeta(bead);
  const widthScale = meta?.strandScale?.width ?? 1;
  const heightScale = meta?.strandScale?.height ?? 1;
  const maxScale = Math.max(widthScale, heightScale);
  return {
    width: widthScale / maxScale,
    height: heightScale / maxScale,
    forceRound: profile.forceRoundFootprint,
  };
}

function strandScaleMeta(bead: BeadLibraryEntry | null | undefined) {
  return bead?.metadata as { strandScale?: { width?: number; height?: number } } | undefined;
}

function layoutDimensionsForMm(
  beadSize: BeadSize,
  scaleFactor: number,
  entry: BeadLibraryEntry | null,
  catalogue?: StrandRenderCatalogueContext,
): BeadSlotDimensions {
  const baseTargetDiameterPx = mmToBasePx(beadSize, scaleFactor);
  const typeScale = typeScaleFor(entry, catalogue);
  const maxScale = Math.max(typeScale.width, typeScale.height);
  return finalizeLayoutFootprint(
    {
      width: baseTargetDiameterPx * (typeScale.width / maxScale),
      height: baseTargetDiameterPx * (typeScale.height / maxScale),
    },
    typeScale.forceRound,
  );
}

function passiveCropGeometry(dimensions: BeadSlotDimensions): BeadCropGeometryDebug {
  const bounds = { left: 0, top: 0, width: dimensions.width, height: dimensions.height };
  return {
    clipPathActive: false,
    renderImageSource: "processed",
    cropPointCount: 0,
    metricsSource: null,
    clipPathBoundsWidthPx: null,
    clipPathBoundsHeightPx: null,
    clipPathBBoxFillPct: null,
    cropPolygonAreaPct: null,
    visiblePolygonAreaPct: null,
    anchorVsVisibleBBoxDeltaPct: null,
    layoutBoundsPx: bounds,
    imageBoundsPx: bounds,
    clipPathBoundsPx: null,
    visibleBoundsPx: null,
    exportVisibleBoundsPx: null,
    cropPolygonPointsPx: null,
    cropPolygonBBoxNorm: null,
    visibleBoundsNorm: null,
  };
}

/** Passive strand sizing — mm slot only; bitmap is pre-baked (no runtime scaling). */
function resolvePassiveStrandSlotSizing(
  beadSize: BeadSize,
  scaleFactor: number,
  entry: BeadLibraryEntry | null,
  sizingPath: BeadRenderSizingPath,
  catalogue?: BeadSlotSizingCatalogueContext,
  groupReferenceDiameterPx: number | null = null,
): BeadSlotSizingResult {
  const baseTargetDiameterPx = mmToBasePx(beadSize, scaleFactor);
  const dimensions = layoutDimensionsForMm(beadSize, scaleFactor, entry, catalogue);
  const bounds = { left: 0, top: 0, width: dimensions.width, height: dimensions.height };

  return {
    dimensions,
    imageDimensions: dimensions,
    imageOffsetPx: { left: 0, top: 0 },
    sizingPath,
    configuredSizeMm: beadSize,
    baseTargetDiameterPx,
    assetVisibleDiameterPx: null,
    groupReferenceDiameterPx,
    mmGroupNormalizationFactor: 1,
    mmGroupActive: false,
    targetDiameterPx: baseTargetDiameterPx,
    appliedScale: 1,
    finalAppliedScale: 1,
    normalizationActive: true,
    normalizationSource: "processedImage",
    normalizationScale: 1,
    squareFallbackReason: null,
    cropConfigPresent: Boolean(entry?.cropConfig),
    renderResolution: null,
    usesProcessedCanvas: true,
    isRoundVisualBead: isRoundVisualBeadType(entry?.beadTypeSlug, catalogue, entry),
    objectFit: null,
    usesClipPath: false,
    wrapperDiameterPx: Math.max(dimensions.width, dimensions.height),
    visibleContentWidthPx: dimensions.width,
    visibleContentHeightPx: dimensions.height,
    visibleContentDiameterPx: Math.max(dimensions.width, dimensions.height),
    actualVisibleDiameterPx: Math.max(dimensions.width, dimensions.height),
    layoutAspectRatio: dimensions.height > 0 ? dimensions.width / dimensions.height : 1,
    finalRenderWidthPx: dimensions.width,
    finalRenderHeightPx: dimensions.height,
    imageRenderWidthPx: dimensions.width,
    imageRenderHeightPx: dimensions.height,
    clipPathBoundsPx: null,
    exportFillRatio: null,
    occupancyRatio: 1,
    polygonBoundingWidthPx: null,
    polygonBoundingHeightPx: null,
    polygonDiameterPx: null,
    imageRenderScale: 1,
    cropGeometry: passiveCropGeometry(dimensions),
  };
}

/**
 * Strand sizing — passive only. Normalization is baked into per-mm exports at save time.
 */
export function resolveBeadSlotSizing(
  bead: PlacedBead | null,
  beadSize: BeadSize,
  scaleFactor: number,
  catalogue?: BeadSlotSizingCatalogueContext,
): BeadSlotSizingResult {
  const entry = bead?.bead ?? null;
  const sizeOffer = mergeSizeOfferFromCatalogue(
    bead?.size,
    catalogue,
    bead?.bead?.id,
  );

  if (hasPreNormalizedStrandAsset(sizeOffer, catalogue)) {
    return resolvePassiveStrandSlotSizing(
      beadSize,
      scaleFactor,
      entry,
      "normalizedVisibleDiameter",
      catalogue,
      sizeOffer?.groupReferenceDiameterPx ?? null,
    );
  }

  if (hasDistinctProcessedAsset(entry)) {
    return resolvePassiveStrandSlotSizing(
      beadSize,
      scaleFactor,
      entry,
      "processedImageNormalized",
      catalogue,
    );
  }

  const config = entry ? resolveBeadCropConfig(entry) : null;
  const usesClipPath = Boolean(config && beadCropClipPathStyles(config));
  const dimensions = layoutDimensionsForMm(beadSize, scaleFactor, entry, catalogue);
  const baseTargetDiameterPx = mmToBasePx(beadSize, scaleFactor);

  let sizingPath: BeadRenderSizingPath = "squareTargetFallback";
  let squareFallbackReason: SquareFallbackReason | null = null;

  if (!entry) {
    squareFallbackReason = "noBead";
  } else if (usesClipPath) {
    sizingPath = "visualBoundsSlotFallback";
  } else if (!config) {
    squareFallbackReason = "noCropConfig";
  }

  return {
    dimensions,
    imageDimensions: dimensions,
    imageOffsetPx: { left: 0, top: 0 },
    sizingPath,
    configuredSizeMm: beadSize,
    baseTargetDiameterPx,
    assetVisibleDiameterPx: null,
    groupReferenceDiameterPx: null,
    mmGroupNormalizationFactor: 1,
    mmGroupActive: false,
    targetDiameterPx: baseTargetDiameterPx,
    appliedScale: 1,
    finalAppliedScale: 1,
    normalizationActive: usesClipPath,
    normalizationSource: "none",
    normalizationScale: 1,
    squareFallbackReason,
    cropConfigPresent: Boolean(config?.imageWidth && config?.imageHeight),
    renderResolution: null,
    usesProcessedCanvas: false,
    isRoundVisualBead: isRoundVisualBeadType(entry?.beadTypeSlug, catalogue, entry),
    objectFit: null,
    usesClipPath,
    wrapperDiameterPx: Math.max(dimensions.width, dimensions.height),
    visibleContentWidthPx: dimensions.width,
    visibleContentHeightPx: dimensions.height,
    visibleContentDiameterPx: Math.max(dimensions.width, dimensions.height),
    actualVisibleDiameterPx: Math.max(dimensions.width, dimensions.height),
    layoutAspectRatio: dimensions.height > 0 ? dimensions.width / dimensions.height : 1,
    finalRenderWidthPx: dimensions.width,
    finalRenderHeightPx: dimensions.height,
    imageRenderWidthPx: dimensions.width,
    imageRenderHeightPx: dimensions.height,
    clipPathBoundsPx: null,
    exportFillRatio: null,
    occupancyRatio: 1,
    polygonBoundingWidthPx: null,
    polygonBoundingHeightPx: null,
    polygonDiameterPx: null,
    imageRenderScale: 1,
    cropGeometry: passiveCropGeometry(dimensions),
  };
}
