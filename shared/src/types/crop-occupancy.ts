import type {
  BeadCropConfig,
  BeadCropPhysicalMetrics,
  BeadPathAnchor,
  BeadVisualBoundsStored,
} from "./bead-crop.js";
import {
  BEAD_CROP_CONFIG_V2,
  getBeadCropPoints,
  predictProcessedExportDimensions,
} from "./bead-crop.js";

export interface CropOccupancyMetrics {
  polygonBoundingWidthPx: number;
  polygonBoundingHeightPx: number;
  polygonDiameterPx: number;
  occupancyRatio: number;
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_OCCUPANCY_RATIO = 0.05;
const MAX_OCCUPANCY_RATIO = 1;

export function anchorPolygonBBoxPx(
  points: { x: number; y: number }[],
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number; diameter: number } | null {
  if (!points.length || imageWidth <= 0 || imageHeight <= 0) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = (maxX - minX) * imageWidth;
  const height = (maxY - minY) * imageHeight;
  if (width <= 0 || height <= 0) return null;
  return { width, height, diameter: Math.max(width, height) };
}

/** Mask bounds in source-image pixels (from stored visual bounds or visible metrics). */
export function resolveMaskBoundsPx(
  imageWidth: number,
  imageHeight: number,
  options: {
    visualBounds?: BeadVisualBoundsStored | null;
    visibleWidthPx?: number;
    visibleHeightPx?: number;
  },
): PixelBounds | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null;

  if (options.visualBounds && options.visualBounds.width > 0 && options.visualBounds.height > 0) {
    const vb = options.visualBounds;
    const width = vb.width * imageWidth;
    const height = vb.height * imageHeight;
    return {
      x: (vb.centerX - vb.width / 2) * imageWidth,
      y: (vb.centerY - vb.height / 2) * imageHeight,
      width,
      height,
    };
  }

  const visibleWidthPx = options.visibleWidthPx ?? 0;
  const visibleHeightPx = options.visibleHeightPx ?? 0;
  if (visibleWidthPx <= 0 || visibleHeightPx <= 0) return null;

  return {
    x: (imageWidth - visibleWidthPx) / 2,
    y: (imageHeight - visibleHeightPx) / 2,
    width: visibleWidthPx,
    height: visibleHeightPx,
  };
}

/** Polygon bbox mapped into export canvas space (matches exportCroppedBeadBlob offsets). */
export function polygonBBoxInExportPx(
  points: { x: number; y: number }[],
  imageWidth: number,
  imageHeight: number,
  maskBounds: PixelBounds,
  processedWidthPx: number,
  processedHeightPx: number,
): { width: number; height: number; diameter: number } | null {
  if (!points.length || processedWidthPx <= 0 || processedHeightPx <= 0) return null;

  const padX = (processedWidthPx - maskBounds.width) / 2;
  const padY = (processedHeightPx - maskBounds.height) / 2;
  const offsetX = padX - maskBounds.x;
  const offsetY = padY - maskBounds.y;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    const x = p.x * imageWidth + offsetX;
    const y = p.y * imageHeight + offsetY;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX)) return null;
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  if (width <= 0 || height <= 0) return null;
  return { width, height, diameter: Math.max(width, height) };
}

export function clampOccupancyRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_OCCUPANCY_RATIO, Math.max(MIN_OCCUPANCY_RATIO, ratio));
}

/**
 * Occupancy of the crop polygon within the exported canvas.
 * ratio = polygonDiameterInExport / max(exportWidth, exportHeight)
 */
export function computeCropOccupancyMetrics(
  points: BeadPathAnchor[],
  imageWidth: number,
  imageHeight: number,
  processedWidthPx: number,
  processedHeightPx: number,
  maskBounds: PixelBounds,
): CropOccupancyMetrics | null {
  const anchorBBox = anchorPolygonBBoxPx(points, imageWidth, imageHeight);
  const exportBBox = polygonBBoxInExportPx(
    points,
    imageWidth,
    imageHeight,
    maskBounds,
    processedWidthPx,
    processedHeightPx,
  );
  if (!anchorBBox || !exportBBox) return null;

  const exportMax = Math.max(processedWidthPx, processedHeightPx);
  const occupancyRatio = clampOccupancyRatio(exportBBox.diameter / exportMax);

  return {
    polygonBoundingWidthPx: anchorBBox.width,
    polygonBoundingHeightPx: anchorBBox.height,
    polygonDiameterPx: anchorBBox.diameter,
    occupancyRatio,
  };
}

export function resolveCropOccupancyRatio(
  metrics?: BeadCropPhysicalMetrics | null,
  config?: BeadCropConfig | null,
): number {
  if (metrics?.occupancyRatio && metrics.occupancyRatio > 0) {
    return clampOccupancyRatio(metrics.occupancyRatio);
  }

  if (!config?.imageWidth || !config.imageHeight) return 1;

  const points = getBeadCropPoints(config);
  if (points.length < 3) return 1;

  const maskBounds = resolveMaskBoundsPx(config.imageWidth, config.imageHeight, {
    visualBounds: config.version === BEAD_CROP_CONFIG_V2 ? config.visualBounds : undefined,
    visibleWidthPx: metrics?.visibleWidthPx,
    visibleHeightPx: metrics?.visibleHeightPx,
  });
  if (!maskBounds) return 1;

  const processedWidthPx =
    metrics?.processedWidthPx ??
    predictProcessedExportDimensions(maskBounds.width, maskBounds.height).processedWidthPx;
  const processedHeightPx =
    metrics?.processedHeightPx ??
    predictProcessedExportDimensions(maskBounds.width, maskBounds.height).processedHeightPx;

  const computed = computeCropOccupancyMetrics(
    points,
    config.imageWidth,
    config.imageHeight,
    processedWidthPx,
    processedHeightPx,
    maskBounds,
  );
  return computed?.occupancyRatio ?? 1;
}

/** Boost render target for image layer only — layout/mm target stays unchanged. */
export function occupancyAdjustedRenderTarget(
  targetDiameterPx: number,
  occupancyRatio: number,
): number {
  if (!Number.isFinite(targetDiameterPx) || targetDiameterPx <= 0) return targetDiameterPx;
  const ratio = clampOccupancyRatio(occupancyRatio);
  return targetDiameterPx / ratio;
}

export function occupancyAdjustedRenderScale(
  uniformScale: number,
  occupancyRatio: number,
): number {
  if (!Number.isFinite(uniformScale) || uniformScale <= 0) return uniformScale;
  const ratio = clampOccupancyRatio(occupancyRatio);
  return uniformScale / ratio;
}
