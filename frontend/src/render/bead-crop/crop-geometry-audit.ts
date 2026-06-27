import type {
  BeadCropConfig,
  BeadCropMetricsResolution,
  BeadPathAnchor,
  BeadVisualBoundsStored,
} from "@bino-foundry/shared/types";
import { BEAD_CROP_CONFIG_V2, getBeadCropPoints } from "@bino-foundry/shared/types";

export interface BeadClipBoundsPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NormBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface BeadCropGeometryDebug {
  clipPathActive: boolean;
  renderImageSource: "processed" | "original" | "unknown";
  cropPointCount: number;
  metricsSource: string | null;
  clipPathBoundsWidthPx: number | null;
  clipPathBoundsHeightPx: number | null;
  /** Axis-aligned bbox of crop polygon / image plane (0–100). */
  clipPathBBoxFillPct: number | null;
  /** Shoelace area of crop path polygon / image plane (0–100). */
  cropPolygonAreaPct: number | null;
  /** Mask visual bounds rectangle / image plane (0–100). */
  visiblePolygonAreaPct: number | null;
  /** |crop bbox area − visible bbox area| / visible bbox area. */
  anchorVsVisibleBBoxDeltaPct: number | null;
  layoutBoundsPx: BeadClipBoundsPx;
  imageBoundsPx: BeadClipBoundsPx;
  clipPathBoundsPx: BeadClipBoundsPx | null;
  visibleBoundsPx: BeadClipBoundsPx | null;
  exportVisibleBoundsPx: BeadClipBoundsPx | null;
  cropPolygonPointsPx: { x: number; y: number }[] | null;
  cropPolygonBBoxNorm: NormBBox | null;
  visibleBoundsNorm: NormBBox | null;
}

export interface CropGeometryLayoutContext {
  layoutWidthPx: number;
  layoutHeightPx: number;
  imageOffsetPx: { left: number; top: number };
  imageWidthPx: number;
  imageHeightPx: number;
  usesProcessedCanvas: boolean;
  usesClipPath: boolean;
  uniformScale: number | null;
}

const DEBUG_KEY = "bino-strand-bead-debug";

function boundsFromSize(width: number, height: number, left = 0, top = 0): BeadClipBoundsPx {
  return { left, top, width, height };
}

/** Shoelace area for a simple polygon in normalized 0–1 coordinates. */
export function polygonAreaNorm(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function normBBoxFromPoints(points: { x: number; y: number }[]): NormBBox | null {
  if (!points.length) return null;
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
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;
  return { minX, minY, maxX, maxY, width, height };
}

function normBBoxFromVisualBounds(vb: BeadVisualBoundsStored): NormBBox {
  const halfW = vb.width / 2;
  const halfH = vb.height / 2;
  const minX = vb.centerX - halfW;
  const minY = vb.centerY - halfH;
  return {
    minX,
    minY,
    maxX: minX + vb.width,
    maxY: minY + vb.height,
    width: vb.width,
    height: vb.height,
  };
}

function mapNormPointToImagePx(
  nx: number,
  ny: number,
  imageBounds: BeadClipBoundsPx,
): { x: number; y: number } {
  return {
    x: imageBounds.left + nx * imageBounds.width,
    y: imageBounds.top + ny * imageBounds.height,
  };
}

function mapNormBBoxToSlotPx(bbox: NormBBox, imageBounds: BeadClipBoundsPx): BeadClipBoundsPx {
  const topLeft = mapNormPointToImagePx(bbox.minX, bbox.minY, imageBounds);
  const bottomRight = mapNormPointToImagePx(bbox.maxX, bbox.maxY, imageBounds);
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function exportVisibleBoundsInSlot(
  imageBounds: BeadClipBoundsPx,
  metrics: BeadCropMetricsResolution["metrics"],
  uniformScale: number | null,
): BeadClipBoundsPx | null {
  const scale = uniformScale ?? 0;
  if (scale <= 0) return null;
  const processedW = metrics.processedWidthPx ?? metrics.visibleWidthPx;
  const processedH = metrics.processedHeightPx ?? metrics.visibleHeightPx;
  if (processedW <= 0 || processedH <= 0) return null;

  const padLeft = (processedW - metrics.visibleWidthPx) / 2;
  const padTop = (processedH - metrics.visibleHeightPx) / 2;

  return {
    left: imageBounds.left + padLeft * scale,
    top: imageBounds.top + padTop * scale,
    width: metrics.visibleWidthPx * scale,
    height: metrics.visibleHeightPx * scale,
  };
}

function pctOfImagePlane(fraction: number): number {
  return fraction * 100;
}

function anchorVsVisibleDeltaPct(
  cropBBox: NormBBox | null,
  visibleBBox: NormBBox | null,
): number | null {
  if (!cropBBox || !visibleBBox) return null;
  const cropArea = cropBBox.width * cropBBox.height;
  const visibleArea = visibleBBox.width * visibleBBox.height;
  if (visibleArea <= 0) return null;
  return pctOfImagePlane(Math.abs(cropArea - visibleArea) / visibleArea);
}

export function resolveBeadCropGeometryDebug(
  config: BeadCropConfig | null | undefined,
  layout: CropGeometryLayoutContext,
  renderResolution: BeadCropMetricsResolution | null,
): BeadCropGeometryDebug {
  const layoutBoundsPx = boundsFromSize(layout.layoutWidthPx, layout.layoutHeightPx);
  const imageBoundsPx = boundsFromSize(
    layout.imageWidthPx,
    layout.imageHeightPx,
    layout.imageOffsetPx.left,
    layout.imageOffsetPx.top,
  );

  const points: BeadPathAnchor[] = config ? getBeadCropPoints(config) : [];
  const cropPolygonBBoxNorm = points.length >= 3 ? normBBoxFromPoints(points) : null;
  const cropPolygonAreaPct =
    points.length >= 3 ? pctOfImagePlane(polygonAreaNorm(points)) : null;
  const clipPathBBoxFillPct = cropPolygonBBoxNorm
    ? pctOfImagePlane(cropPolygonBBoxNorm.width * cropPolygonBBoxNorm.height)
    : null;

  let visibleBoundsNorm: NormBBox | null = null;
  let visiblePolygonAreaPct: number | null = null;
  if (config?.version === BEAD_CROP_CONFIG_V2 && config.visualBounds) {
    visibleBoundsNorm = normBBoxFromVisualBounds(config.visualBounds);
    visiblePolygonAreaPct = pctOfImagePlane(
      config.visualBounds.width * config.visualBounds.height,
    );
  } else if (renderResolution?.metrics && config?.imageWidth && config.imageHeight) {
    const m = renderResolution.metrics;
    const w = m.visibleWidthPx / config.imageWidth;
    const h = m.visibleHeightPx / config.imageHeight;
    visibleBoundsNorm = {
      minX: 0.5 - w / 2,
      minY: 0.5 - h / 2,
      maxX: 0.5 + w / 2,
      maxY: 0.5 + h / 2,
      width: w,
      height: h,
    };
    visiblePolygonAreaPct = pctOfImagePlane(w * h);
  }

  const clipPathBoundsPx = cropPolygonBBoxNorm
    ? mapNormBBoxToSlotPx(cropPolygonBBoxNorm, imageBoundsPx)
    : null;

  const visibleBoundsPx = visibleBoundsNorm
    ? mapNormBBoxToSlotPx(visibleBoundsNorm, imageBoundsPx)
    : null;

  const cropPolygonPointsPx =
    points.length >= 3
      ? points.map((p) => mapNormPointToImagePx(p.x, p.y, imageBoundsPx))
      : null;

  const exportVisibleBoundsPx =
    layout.usesProcessedCanvas && renderResolution?.metrics
      ? exportVisibleBoundsInSlot(
          imageBoundsPx,
          renderResolution.metrics,
          layout.uniformScale,
        )
      : visibleBoundsPx;

  return {
    clipPathActive: layout.usesClipPath,
    renderImageSource: layout.usesProcessedCanvas
      ? "processed"
      : config
        ? "original"
        : "unknown",
    cropPointCount: points.length,
    metricsSource: renderResolution?.source ?? null,
    clipPathBoundsWidthPx: clipPathBoundsPx?.width ?? null,
    clipPathBoundsHeightPx: clipPathBoundsPx?.height ?? null,
    clipPathBBoxFillPct,
    cropPolygonAreaPct,
    visiblePolygonAreaPct,
    anchorVsVisibleBBoxDeltaPct: anchorVsVisibleDeltaPct(
      cropPolygonBBoxNorm,
      visibleBoundsNorm,
    ),
    layoutBoundsPx,
    imageBoundsPx,
    clipPathBoundsPx,
    visibleBoundsPx,
    exportVisibleBoundsPx,
    cropPolygonPointsPx,
    cropPolygonBBoxNorm,
    visibleBoundsNorm,
  };
}

/** Full geometry overlay — wrapper, image, clip polygon (`bino-strand-bead-debug=2`). */
export function isStrandBeadGeometryOverlayEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(DEBUG_KEY);
    return v === "2" || v === "geometry";
  } catch {
    return false;
  }
}
