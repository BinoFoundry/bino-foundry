import type { CSSProperties } from "react";
import type { BeadSize, PlacedBead } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadTypeEntry } from "@/types/beads";
import type { BeadCropMetricsResolution, BeadCropMetricsSource, BeadCropPhysicalMetrics } from "@bino-foundry/shared/types";

import {
  hasDistinctProcessedAsset,
  hasPreNormalizedStrandAsset,
  beadCropClipPathStyles,
  mergeSizeOfferFromCatalogue,
  resolveStrandDeliveryUrl,
} from "./apply-crop";
import { resolveBeadCropConfig } from "./resolve-bead-crop-config";
import {
  beadExportSilhouetteFillRatio,
  deriveBeadVisualBoundsNorm,
  resolveBeadPhysicalMetrics,
  resolveBeadRenderFootprintPx,
  resolveBeadVisibleDiameterPx,
} from "@bino-foundry/shared/types/bead-crop";
import { layoutDiameterPxForMm } from "./canonical-strand-mm-scale";
import { resolveBeadCropGeometryDebug } from "./crop-geometry-audit";
import { peekProcessedStrandMetrics } from "./processed-strand-metrics";
import { resolveStrandRenderProfile, type StrandRenderCatalogueContext } from "./strand-render-profile";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

export interface BeadSlotDimensions {
  width: number;
  height: number;
}

export interface BeadSlotSizingCatalogueContext extends StrandRenderCatalogueContext {
  beadSizes?: BeadSizeEntry[];
  beadLibrarySizes?: BeadLibrarySizeOffer[];
  beadTypes?: BeadTypeEntry[];
  /** Live Preview draft — image scale follows Layout even before Save. */
  forceLayoutMode?: StrandRenderProfile["layoutMode"];
}

function mmToBasePx(sizeMm: number, scaleFactor: number): number {
  return layoutDiameterPxForMm(sizeMm, scaleFactor);
}

function canonicalVisibleDiameterPx(
  entry: BeadLibraryEntry | null,
): number | null {
  if (!entry) return null;
  const config = resolveBeadCropConfig(entry);
  const metrics = config?.metrics;
  if (!metrics) return null;
  const visible = resolveBeadVisibleDiameterPx(metrics);
  return visible > 0 ? visible : null;
}

function baseTargetDiameterPxForMm(beadSize: BeadSize, scaleFactor: number): number {
  return mmToBasePx(beadSize, scaleFactor);
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
  const layoutMode =
    (catalogue as BeadSlotSizingCatalogueContext | undefined)?.forceLayoutMode ?? profile.layoutMode;
  const meta = strandScaleMeta(bead);
  const widthScale = meta?.strandScale?.width ?? 1;
  const heightScale = meta?.strandScale?.height ?? 1;
  const maxScale = Math.max(widthScale, heightScale);
  return {
    width: widthScale / maxScale,
    height: heightScale / maxScale,
    forceRound: layoutMode === "inline" ? true : profile.forceRoundFootprint,
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
  const baseTargetDiameterPx = baseTargetDiameterPxForMm(beadSize, scaleFactor);
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

interface UniformStrandImageLayout {
  imageDimensions: BeadSlotDimensions;
  imageOffsetPx: BeadSlotOffsetPx;
  imageRenderScale: number;
  assetVisibleDiameterPx: number | null;
  renderResolution: ReturnType<typeof resolveBeadPhysicalMetrics>;
  visibleContentWidthPx: number;
  visibleContentHeightPx: number;
  visibleContentDiameterPx: number;
  actualVisibleDiameterPx: number;
  exportFillRatio: number | null;
  /** When dangling scale expands the shell beyond the mm square. */
  shellDimensions?: BeadSlotDimensions;
}

/**
 * Prefer alpha-measured bounds from the processed PNG when available.
 * Crop-mask metrics overstate diameter when the silhouette has transparent padding
 * inside the path — that makes same-mm charms look smaller than filled beads.
 */
function resolveStrandLayoutMetrics(
  entry: BeadLibraryEntry | null,
  preferProcessedCanvas: boolean,
): ReturnType<typeof resolveBeadPhysicalMetrics> {
  const config = entry ? resolveBeadCropConfig(entry) : null;
  const stored = config ? resolveBeadPhysicalMetrics(config) : null;

  if (!preferProcessedCanvas || !entry) return stored;

  const url = resolveStrandDeliveryUrl(entry);
  const live = peekProcessedStrandMetrics(url);
  if (!live || resolveBeadVisibleDiameterPx(live) <= 0) return stored;

  return {
    metrics: live,
    source: "physicalMetrics",
    needsRecropReview: false,
  };
}

/**
 * True painted content size for dangling charms.
 * Rejects full-canvas crop-mask "visible" bounds that count transparent padding.
 */
function resolveDanglingContentSizePx(metrics: BeadCropPhysicalMetrics): {
  contentWidthPx: number;
  contentHeightPx: number;
} {
  const visibleDiameter = resolveBeadVisibleDiameterPx(metrics);
  const processedW = metrics.processedWidthPx ?? 0;
  const processedH = metrics.processedHeightPx ?? 0;
  const processedMax = Math.max(processedW, processedH);
  let width = metrics.visibleWidthPx > 0 ? metrics.visibleWidthPx : visibleDiameter;
  let height = metrics.visibleHeightPx > 0 ? metrics.visibleHeightPx : visibleDiameter;
  if (width <= 0) width = Math.max(visibleDiameter, 1);
  if (height <= 0) height = Math.max(visibleDiameter, 1);

  const widthFills = processedW > 0 && width >= processedW * 0.9;
  const heightFills = processedH > 0 && height >= processedH * 0.9;
  const fill = beadExportSilhouetteFillRatio(metrics);
  const occupancy =
    typeof metrics.occupancyRatio === "number" && metrics.occupancyRatio > 0
      ? metrics.occupancyRatio
      : fill;

  // Both axes claim the canvas — stored mask is pad, not paint.
  if (widthFills && heightFills) {
    if (occupancy != null && occupancy > 0 && occupancy < 0.98) {
      // Recover an approximate paint box from canvas × occupancy (square-ish prior).
      const side = processedMax * occupancy;
      return {
        contentWidthPx: Math.max(side, 1),
        contentHeightPx: Math.max(side * (height / Math.max(width, 1)), side, 1),
      };
    }
    // Last resort: assume moderately padded export (~70% fill) rather than trusting full canvas.
    const assumed = processedMax > 0 ? processedMax * 0.7 : visibleDiameter;
    return { contentWidthPx: Math.max(assumed, 1), contentHeightPx: Math.max(assumed, 1) };
  }

  // Width inflated, height looks real (tall charm on padded square mask).
  if (widthFills && !heightFills) {
    // Estimate width from height using a conservative aspect (avoid using inflated width).
    const estimatedWidth = Math.min(height, processedW > 0 ? processedW * 0.7 : height);
    return {
      contentWidthPx: Math.max(estimatedWidth, 1),
      contentHeightPx: Math.max(height, 1),
    };
  }

  return { contentWidthPx: width, contentHeightPx: height };
}

/** Uniform scale for crop bitmap inside mm wrapper — scaleX always equals scaleY. */
function resolveUniformStrandImageLayout(
  dimensions: BeadSlotDimensions,
  entry: BeadLibraryEntry | null,
  options: {
    preferProcessedCanvas: boolean;
    scaleReferenceDiameterPx?: number | null;
    /**
     * When true (dangling / non-round charms), match catalogue mm to content WIDTH
     * so tall dangles extend naturally instead of shrinking the charm body.
     */
    scaleToContentWidth?: boolean;
  },
): UniformStrandImageLayout {
  const config = entry ? resolveBeadCropConfig(entry) : null;
  const renderResolution = resolveStrandLayoutMetrics(entry, options.preferProcessedCanvas);
  const wrapperDiameter = Math.max(dimensions.width, dimensions.height);

  const visualBounds = config ? deriveBeadVisualBoundsNorm(config) : null;
  const boundsVisibleWidth = visualBounds
    ? dimensions.width * visualBounds.width
    : dimensions.width;
  const boundsVisibleHeight = visualBounds
    ? dimensions.height * visualBounds.height
    : dimensions.height;
  const boundsVisibleDiameter = Math.max(boundsVisibleWidth, boundsVisibleHeight);

  const fallback: UniformStrandImageLayout = {
    imageDimensions: dimensions,
    imageOffsetPx: { left: 0, top: 0 },
    imageRenderScale: 1,
    assetVisibleDiameterPx: canonicalVisibleDiameterPx(entry),
    renderResolution,
    visibleContentWidthPx: boundsVisibleWidth,
    visibleContentHeightPx: boundsVisibleHeight,
    visibleContentDiameterPx: boundsVisibleDiameter,
    actualVisibleDiameterPx: boundsVisibleDiameter,
    exportFillRatio: null,
  };

  if (!renderResolution?.metrics) return fallback;

  const metrics = renderResolution.metrics;
  const visibleDiameter = resolveBeadVisibleDiameterPx(metrics);

  // ── Dangling: mm maps to painted WIDTH; shell follows content aspect (not pad). ──
  if (options.scaleToContentWidth) {
    const { contentWidthPx, contentHeightPx } = resolveDanglingContentSizePx(metrics);
    const scale = contentWidthPx > 0 ? wrapperDiameter / contentWidthPx : 1;
    const contentShell = {
      width: wrapperDiameter,
      height: Math.max(wrapperDiameter, contentHeightPx * scale),
    };

    const processedW = metrics.processedWidthPx ?? contentWidthPx;
    const processedH = metrics.processedHeightPx ?? contentHeightPx;
    // Image layer = full processed canvas at content-width scale (pad hangs outside content shell).
    const imageDimensions = {
      width: Math.max(1, processedW * scale),
      height: Math.max(1, processedH * scale),
    };

    return {
      imageDimensions,
      imageOffsetPx: { left: 0, top: 0 },
      imageRenderScale: scale,
      assetVisibleDiameterPx: Math.max(contentWidthPx, contentHeightPx),
      renderResolution,
      visibleContentWidthPx: contentShell.width,
      visibleContentHeightPx: contentShell.height,
      visibleContentDiameterPx: Math.max(contentShell.width, contentShell.height),
      actualVisibleDiameterPx: Math.max(contentShell.width, contentShell.height),
      exportFillRatio: beadExportSilhouetteFillRatio(metrics),
      // Packing / CSS shell use the content box (mm × proportional height) — never the pad canvas.
      shellDimensions: contentShell,
    };
  }

  // ── Inline / round: mm maps to visible diameter (max edge). ──
  const scaleDenom =
    options.scaleReferenceDiameterPx && options.scaleReferenceDiameterPx > 0
      ? options.scaleReferenceDiameterPx
      : visibleDiameter;
  const uniformScale = scaleDenom > 0 ? wrapperDiameter / scaleDenom : 1;

  const imageFootprint = resolveBeadRenderFootprintPx(renderResolution, {
    targetDiameterPx: wrapperDiameter,
    preferProcessedCanvas: options.preferProcessedCanvas,
    scaleReferenceDiameterPx: options.scaleReferenceDiameterPx ?? undefined,
  });
  if (!imageFootprint) return fallback;

  const visibleFootprint = resolveBeadRenderFootprintPx(renderResolution, {
    targetDiameterPx: wrapperDiameter,
    preferProcessedCanvas: false,
    scaleReferenceDiameterPx: options.scaleReferenceDiameterPx ?? undefined,
  });

  const imageOffsetPx = { left: 0, top: 0 };
  const visibleW = visibleFootprint?.width ?? imageFootprint.width;
  const visibleH = visibleFootprint?.height ?? imageFootprint.height;

  return {
    imageDimensions: imageFootprint,
    imageOffsetPx,
    imageRenderScale: uniformScale,
    assetVisibleDiameterPx: visibleDiameter > 0 ? visibleDiameter : null,
    renderResolution,
    visibleContentWidthPx: visibleW,
    visibleContentHeightPx: visibleH,
    visibleContentDiameterPx: Math.max(visibleW, visibleH),
    actualVisibleDiameterPx: Math.max(visibleW, visibleH),
    exportFillRatio: beadExportSilhouetteFillRatio(metrics),
  };
}

function buildStrandSlotSizingResult(
  beadSize: BeadSize,
  scaleFactor: number,
  entry: BeadLibraryEntry | null,
  sizingPath: BeadRenderSizingPath,
  catalogue: BeadSlotSizingCatalogueContext | undefined,
  options: {
    preferProcessedCanvas: boolean;
    usesClipPath: boolean;
    groupReferenceDiameterPx?: number | null;
    squareFallbackReason?: SquareFallbackReason | null;
  },
): BeadSlotSizingResult {
  const baseTargetDiameterPx = baseTargetDiameterPxForMm(beadSize, scaleFactor);
  const baseDimensions = layoutDimensionsForMm(beadSize, scaleFactor, entry, catalogue);
  const profile = resolveStrandRenderProfile(entry ?? null, catalogue);
  const layoutMode = catalogue?.forceLayoutMode ?? profile.layoutMode;
  const scaleToContentWidth = layoutMode === "dangling";
  const imageLayout = resolveUniformStrandImageLayout(baseDimensions, entry, {
    preferProcessedCanvas: options.preferProcessedCanvas,
    scaleToContentWidth,
  });
  const dimensions = imageLayout.shellDimensions ?? baseDimensions;
  const wrapperDiameterPx = Math.max(dimensions.width, dimensions.height);

  const config = entry ? resolveBeadCropConfig(entry) : null;
  const cropGeometry = resolveBeadCropGeometryDebug(
    config,
    {
      layoutWidthPx: dimensions.width,
      layoutHeightPx: dimensions.height,
      imageOffsetPx: imageLayout.imageOffsetPx,
      imageWidthPx: imageLayout.imageDimensions.width,
      imageHeightPx: imageLayout.imageDimensions.height,
      usesProcessedCanvas: options.preferProcessedCanvas,
      usesClipPath: options.usesClipPath,
      uniformScale: imageLayout.imageRenderScale,
    },
    imageLayout.renderResolution,
  );

  return {
    dimensions,
    imageDimensions: imageLayout.imageDimensions,
    imageOffsetPx: imageLayout.imageOffsetPx,
    sizingPath,
    configuredSizeMm: beadSize,
    baseTargetDiameterPx,
    assetVisibleDiameterPx: imageLayout.assetVisibleDiameterPx,
    groupReferenceDiameterPx: options.groupReferenceDiameterPx ?? null,
    mmGroupNormalizationFactor: 1,
    mmGroupActive: false,
    targetDiameterPx: baseTargetDiameterPx,
    appliedScale: imageLayout.imageRenderScale,
    finalAppliedScale: imageLayout.imageRenderScale,
    normalizationActive: options.preferProcessedCanvas || options.usesClipPath,
    normalizationSource: options.preferProcessedCanvas ? "processedImage" : "none",
    normalizationScale: imageLayout.imageRenderScale,
    squareFallbackReason: options.squareFallbackReason ?? null,
    cropConfigPresent: Boolean(config?.imageWidth && config?.imageHeight),
    renderResolution: imageLayout.renderResolution,
    usesProcessedCanvas: options.preferProcessedCanvas,
    isRoundVisualBead: isRoundVisualBeadType(entry?.beadTypeSlug, catalogue, entry),
    objectFit: null,
    usesClipPath: options.usesClipPath,
    wrapperDiameterPx,
    visibleContentWidthPx: imageLayout.visibleContentWidthPx,
    visibleContentHeightPx: imageLayout.visibleContentHeightPx,
    visibleContentDiameterPx: imageLayout.visibleContentDiameterPx,
    actualVisibleDiameterPx: imageLayout.actualVisibleDiameterPx,
    layoutAspectRatio: dimensions.height > 0 ? dimensions.width / dimensions.height : 1,
    finalRenderWidthPx: dimensions.width,
    finalRenderHeightPx: dimensions.height,
    imageRenderWidthPx: imageLayout.imageDimensions.width,
    imageRenderHeightPx: imageLayout.imageDimensions.height,
    clipPathBoundsPx: cropGeometry.clipPathBoundsPx,
    exportFillRatio: imageLayout.exportFillRatio,
    occupancyRatio: 1,
    polygonBoundingWidthPx: cropGeometry.clipPathBoundsWidthPx,
    polygonBoundingHeightPx: cropGeometry.clipPathBoundsHeightPx,
    polygonDiameterPx:
      cropGeometry.clipPathBoundsWidthPx && cropGeometry.clipPathBoundsHeightPx
        ? Math.max(cropGeometry.clipPathBoundsWidthPx, cropGeometry.clipPathBoundsHeightPx)
        : null,
    imageRenderScale: imageLayout.imageRenderScale,
    cropGeometry,
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
    return buildStrandSlotSizingResult(beadSize, scaleFactor, entry, "normalizedVisibleDiameter", catalogue, {
      preferProcessedCanvas: true,
      usesClipPath: false,
      groupReferenceDiameterPx: sizeOffer?.groupReferenceDiameterPx ?? null,
    });
  }

  if (hasDistinctProcessedAsset(entry)) {
    return buildStrandSlotSizingResult(beadSize, scaleFactor, entry, "processedImageNormalized", catalogue, {
      preferProcessedCanvas: true,
      usesClipPath: false,
    });
  }

  const config = entry ? resolveBeadCropConfig(entry) : null;
  const usesClipPath = Boolean(config && beadCropClipPathStyles(config));

  let sizingPath: BeadRenderSizingPath = "squareTargetFallback";
  let squareFallbackReason: SquareFallbackReason | null = null;

  if (!entry) {
    squareFallbackReason = "noBead";
  } else if (usesClipPath) {
    sizingPath = "visualBoundsSlotFallback";
  } else if (!config) {
    squareFallbackReason = "noCropConfig";
  }

  return buildStrandSlotSizingResult(beadSize, scaleFactor, entry, sizingPath, catalogue, {
    preferProcessedCanvas: false,
    usesClipPath,
    squareFallbackReason,
  });
}

/**
 * Tangential arc for neighbour spacing — visible silhouette along the strand,
 * never PNG/processed canvas padding or the mm wrapper alone.
 */
export function getBeadStrandTangentContactPx(
  sizing: Pick<
    BeadSlotSizingResult,
    | "dimensions"
    | "visibleContentWidthPx"
    | "visibleContentDiameterPx"
    | "actualVisibleDiameterPx"
    | "isRoundVisualBead"
    | "exportFillRatio"
  >,
): number {
  const wrapperTangent = sizing.dimensions.width;
  const visible = sizing.isRoundVisualBead
    ? sizing.actualVisibleDiameterPx ??
      sizing.visibleContentDiameterPx ??
      sizing.visibleContentWidthPx
    : sizing.visibleContentWidthPx ??
      sizing.actualVisibleDiameterPx ??
      sizing.visibleContentDiameterPx;

  let contactPx = wrapperTangent;
  if (visible != null && visible > 0 && Number.isFinite(visible)) {
    contactPx = Math.min(wrapperTangent, visible);
  }

  const fill = sizing.exportFillRatio;
  if (fill != null && fill > 0 && fill < 1) {
    contactPx = Math.min(contactPx, wrapperTangent * fill);
  }

  return contactPx;
}
