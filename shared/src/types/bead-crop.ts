/** Normalized point (0–1 relative to natural image size). */
export interface BeadNormPoint {
  x: number;
  y: number;
}

/**
 * Bézier path anchor (same semantics as frame mask `PathAnchor`).
 * Segment from this anchor → next uses `curved` + optional handles.
 */
export interface BeadPathAnchor extends BeadNormPoint {
  curved?: boolean;
  handleIn?: BeadNormPoint | null;
  handleOut?: BeadNormPoint | null;
}

/** @deprecated v1 rect crop — use v2 `points` for manual path crop. */
export interface BeadCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BeadCropShape = "circle" | "rect";
export type BeadCropStatus = "draft" | "ready";

export const BEAD_CROP_CONFIG_V1 = 1 as const;
export const BEAD_CROP_CONFIG_V2 = 2 as const;
export const BEAD_CROP_CONFIG_VERSION = BEAD_CROP_CONFIG_V2;

/** v1 — legacy rectangular/circular crop (read-only migration source). */
export interface BeadCropConfigV1 {
  version: typeof BEAD_CROP_CONFIG_V1;
  imageWidth: number;
  imageHeight: number;
  originalUrl: string;
  processedUrl?: string;
  crop: BeadCropRect;
  scale: number;
  shape: BeadCropShape;
  autoDetected?: boolean;
  updatedAt?: number;
}

export interface BeadCropDetectionMeta {
  autoDetected?: boolean;
  confidence?: number;
  contourPointCount?: number;
  pathPointCount?: number;
  curvedSegmentCount?: number;
}

/** Precomputed visible silhouette (0–1 relative to source image). */
export interface BeadVisualBoundsStored {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Pixel-space visible silhouette metrics computed once at save — mm maps to referenceDiameterPx.
 * Builder reads these only; no image analysis at render time.
 */
export interface BeadCropPhysicalMetrics {
  /** Visible silhouette width in source-image pixels (filled-alpha mask bounds). */
  visibleWidthPx: number;
  /** Visible silhouette height in source-image pixels. */
  visibleHeightPx: number;
  /** max(visibleWidthPx, visibleHeightPx) — mm maps here at render time. */
  referenceDiameterPx: number;
  /** Explicit alias for referenceDiameterPx (visible silhouette diameter). */
  visibleDiameterPx?: number;
  /** Processed export canvas width (includes transparent pad), when exported. */
  processedWidthPx?: number;
  /** Processed export canvas height (includes transparent pad), when exported. */
  processedHeightPx?: number;
  /**
   * Left edge of the painted silhouette in processed-canvas pixels.
   * Used to align dangling charms so mm maps to paint, not transparent pad.
   */
  visibleOriginXPx?: number;
  /** Top edge of the painted silhouette in processed-canvas pixels. */
  visibleOriginYPx?: number;
  /** Axis-aligned bbox width of the crop path polygon in source-image pixels. */
  polygonBoundingWidthPx?: number;
  /** Axis-aligned bbox height of the crop path polygon in source-image pixels. */
  polygonBoundingHeightPx?: number;
  /** max(polygonBoundingWidthPx, polygonBoundingHeightPx). */
  polygonDiameterPx?: number;
  /** Crop polygon diameter in export space / max(exportW, exportH) — render scale divisor. */
  occupancyRatio?: number;
  /** @deprecated Alias for visibleWidthPx — legacy persisted field. */
  cropWidthPx?: number;
  /** @deprecated Alias for visibleHeightPx — legacy persisted field. */
  cropHeightPx?: number;
}

export type BeadCropMetricsSource =
  | "physicalMetrics"
  | "visualBounds"
  | "cropRect"
  | "anchorEstimate"
  | "missing";

/** Sources safe for bracelet render sizing (excludes anchor path-point estimates). */
export function isReliableMetricsSource(source: BeadCropMetricsSource): boolean {
  return source === "physicalMetrics" || source === "visualBounds" || source === "cropRect";
}

export interface BeadCropMetricsResolution {
  metrics: BeadCropPhysicalMetrics;
  source: BeadCropMetricsSource;
  /** True when metrics may include transparent padding (v1 rect or anchor estimate). */
  needsRecropReview: boolean;
}

/** Delivery URLs for builder (admin uses original). */
export interface BeadDeliveryUrls {
  png?: string;
  webp?: string;
  avif?: string;
}

/** v2 — manual closed path crop (curve/point editor). */
export interface BeadCropConfigV2 {
  version: typeof BEAD_CROP_CONFIG_V2;
  imageWidth: number;
  imageHeight: number;
  originalUrl: string;
  processedUrl?: string;
  /** Closed crop boundary in normalized image coordinates. */
  points: BeadPathAnchor[];
  scale: number;
  updatedAt?: number;
  /** Non-destructive auto-detect metadata (original image unchanged). */
  detection?: BeadCropDetectionMeta;
  /** Cached mask bounds — silhouette center/clip (shape only). */
  visualBounds?: BeadVisualBoundsStored;
  /** Pixel crop metrics — physical mm sizing (computed at save). */
  physicalMetrics?: BeadCropPhysicalMetrics;
  /** Optimized builder delivery URLs (avif > webp > png). */
  deliveryUrls?: BeadDeliveryUrls;
}

export type BeadCropConfig = BeadCropConfigV1 | BeadCropConfigV2;

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function normalizeBeadAnchor(p: Partial<BeadPathAnchor> & BeadNormPoint): BeadPathAnchor {
  return {
    x: clamp01(p.x),
    y: clamp01(p.y),
    curved: Boolean(p.curved),
    handleIn: p.handleIn ? { x: clamp01(p.handleIn.x), y: clamp01(p.handleIn.y) } : null,
    handleOut: p.handleOut ? { x: clamp01(p.handleOut.x), y: clamp01(p.handleOut.y) } : null,
  };
}

export function migrateBeadAnchors(points: BeadPathAnchor[] | undefined): BeadPathAnchor[] {
  if (!points?.length) return [];
  return points.map((p) => {
    if ("curved" in p || p.handleIn || p.handleOut) return normalizeBeadAnchor(p);
    return normalizeBeadAnchor({ x: p.x, y: p.y, curved: false, handleIn: null, handleOut: null });
  });
}

/** @deprecated v1 only */
export function normalizeCropRect(rect: Partial<BeadCropRect>): BeadCropRect {
  const x = clamp01(rect.x ?? 0);
  const y = clamp01(rect.y ?? 0);
  const width = clamp01(rect.width ?? 1);
  const height = clamp01(rect.height ?? 1);
  return {
    x,
    y,
    width: Math.min(width, 1 - x),
    height: Math.min(height, 1 - y),
  };
}

/** Convert legacy rect crop to four corner anchors (starting point for re-editing v1 data). */
export function beadCropRectToPathAnchors(rect: BeadCropRect): BeadPathAnchor[] {
  const r = normalizeCropRect(rect);
  return [
    normalizeBeadAnchor({ x: r.x, y: r.y }),
    normalizeBeadAnchor({ x: r.x + r.width, y: r.y }),
    normalizeBeadAnchor({ x: r.x + r.width, y: r.y + r.height }),
    normalizeBeadAnchor({ x: r.x, y: r.y + r.height }),
  ];
}

export function createBeadCropConfigV2(
  imageWidth: number,
  imageHeight: number,
  originalUrl: string,
  points: BeadPathAnchor[],
  options?: Partial<
    Pick<
      BeadCropConfigV2,
      "processedUrl" | "scale" | "detection" | "visualBounds" | "physicalMetrics" | "deliveryUrls"
    >
  >,
): BeadCropConfigV2 {
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth,
    imageHeight,
    originalUrl,
    processedUrl: options?.processedUrl,
    points: migrateBeadAnchors(points),
    scale: options?.scale ?? 1,
    updatedAt: Date.now(),
    detection: options?.detection,
    visualBounds: options?.visualBounds,
    physicalMetrics: options?.physicalMetrics,
    deliveryUrls: options?.deliveryUrls,
  };
}

/** @deprecated Use createBeadCropConfigV2 */
export function createBeadCropConfig(
  imageWidth: number,
  imageHeight: number,
  originalUrl: string,
  crop: Partial<BeadCropRect>,
  options?: Partial<Pick<BeadCropConfigV1, "processedUrl" | "scale" | "shape" | "autoDetected">>,
): BeadCropConfigV1 {
  return {
    version: BEAD_CROP_CONFIG_V1,
    imageWidth,
    imageHeight,
    originalUrl,
    processedUrl: options?.processedUrl,
    crop: normalizeCropRect(crop),
    scale: options?.scale ?? 1,
    shape: options?.shape ?? "circle",
    autoDetected: options?.autoDetected,
    updatedAt: Date.now(),
  };
}

export function getBeadCropPoints(config: BeadCropConfig | null | undefined): BeadPathAnchor[] {
  if (!config) return [];
  if (config.version === BEAD_CROP_CONFIG_V2) return migrateBeadAnchors(config.points);
  if (config.version === BEAD_CROP_CONFIG_V1 && config.crop) {
    return beadCropRectToPathAnchors(config.crop);
  }
  return [];
}

export function isBeadCropConfigValid(config: unknown): config is BeadCropConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as BeadCropConfig;
  if (!c.originalUrl?.trim()) return false;
  if (!c.imageWidth || !c.imageHeight) return false;

  if (c.version === BEAD_CROP_CONFIG_V2) {
    return migrateBeadAnchors(c.points).length >= 3;
  }
  if (c.version === BEAD_CROP_CONFIG_V1) {
    const crop = c.crop;
    return Boolean(crop && crop.width > 0.02 && crop.height > 0.02);
  }
  return false;
}

export function isBeadCropPathReady(config: BeadCropConfig | null | undefined): boolean {
  return config?.version === BEAD_CROP_CONFIG_V2 && migrateBeadAnchors(config.points).length >= 3;
}

function anchorBoundsNormFromPoints(points: BeadPathAnchor[]): BeadVisualBoundsStored | null {
  if (points.length < 3) return null;
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
  return {
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

function metricsValid(metrics: BeadCropPhysicalMetrics | undefined): metrics is BeadCropPhysicalMetrics {
  const w = metrics?.visibleWidthPx ?? metrics?.cropWidthPx ?? 0;
  const h = metrics?.visibleHeightPx ?? metrics?.cropHeightPx ?? 0;
  const ref = metrics?.referenceDiameterPx ?? 0;
  return ref > 0 && w > 0 && h > 0;
}

function normalizePhysicalMetrics(metrics: BeadCropPhysicalMetrics): BeadCropPhysicalMetrics {
  const visibleWidthPx = metrics.visibleWidthPx ?? metrics.cropWidthPx ?? 0;
  const visibleHeightPx = metrics.visibleHeightPx ?? metrics.cropHeightPx ?? 0;
  const visibleDiameterPx =
    metrics.visibleDiameterPx && metrics.visibleDiameterPx > 0
      ? metrics.visibleDiameterPx
      : metrics.referenceDiameterPx > 0
        ? metrics.referenceDiameterPx
        : Math.max(visibleWidthPx, visibleHeightPx);
  const predicted = predictProcessedExportDimensions(visibleWidthPx, visibleHeightPx);
  return {
    visibleWidthPx,
    visibleHeightPx,
    referenceDiameterPx: visibleDiameterPx,
    visibleDiameterPx,
    processedWidthPx: metrics.processedWidthPx ?? predicted.processedWidthPx,
    processedHeightPx: metrics.processedHeightPx ?? predicted.processedHeightPx,
    visibleOriginXPx: metrics.visibleOriginXPx,
    visibleOriginYPx: metrics.visibleOriginYPx,
    polygonBoundingWidthPx: metrics.polygonBoundingWidthPx,
    polygonBoundingHeightPx: metrics.polygonBoundingHeightPx,
    polygonDiameterPx: metrics.polygonDiameterPx,
    occupancyRatio: metrics.occupancyRatio,
  };
}

function metricsFromNormBounds(
  bounds: BeadVisualBoundsStored,
  imageWidth: number,
  imageHeight: number,
): BeadCropPhysicalMetrics {
  const visibleWidthPx = bounds.width * imageWidth;
  const visibleHeightPx = bounds.height * imageHeight;
  const visibleDiameterPx = Math.max(visibleWidthPx, visibleHeightPx);
  const processed = predictProcessedExportDimensions(visibleWidthPx, visibleHeightPx);
  return {
    visibleWidthPx,
    visibleHeightPx,
    referenceDiameterPx: visibleDiameterPx,
    visibleDiameterPx,
    processedWidthPx: processed.processedWidthPx,
    processedHeightPx: processed.processedHeightPx,
  };
}

/** Matches exportCroppedBeadBlob padding — used when processed px not stored yet. */
export function predictProcessedExportDimensions(
  visibleWidthPx: number,
  visibleHeightPx: number,
): { processedWidthPx: number; processedHeightPx: number } {
  const pad = Math.round(Math.max(visibleWidthPx, visibleHeightPx) * 0.04);
  return {
    processedWidthPx: visibleWidthPx + pad * 2,
    processedHeightPx: visibleHeightPx + pad * 2,
  };
}

function effectiveProcessedCanvas(
  metrics: BeadCropPhysicalMetrics,
): { processedWidthPx: number; processedHeightPx: number } {
  if (metrics.processedWidthPx && metrics.processedHeightPx) {
    return {
      processedWidthPx: metrics.processedWidthPx,
      processedHeightPx: metrics.processedHeightPx,
    };
  }
  return predictProcessedExportDimensions(metrics.visibleWidthPx, metrics.visibleHeightPx);
}

/** Stored visible diameter used for mm → px scaling at render time. */
export function resolveBeadVisibleDiameterPx(
  metrics: BeadCropPhysicalMetrics | null | undefined,
): number {
  if (!metrics) return 0;
  return (
    metrics.visibleDiameterPx ??
    metrics.referenceDiameterPx ??
    Math.max(metrics.visibleWidthPx, metrics.visibleHeightPx)
  );
}

/**
 * Builder footprint in px — mm maps to the visible silhouette, not export canvas padding.
 * When preferProcessedCanvas is true, returns scaled export canvas (for image layer only).
 */
export function resolveBeadRenderFootprintPx(
  resolution: BeadCropMetricsResolution | null,
  options: {
    targetDiameterPx: number;
    preferProcessedCanvas?: boolean;
    widthScale?: number;
    heightScale?: number;
    /** When set (mm-group largest reference), uniform scale uses this instead of per-asset visible diameter. */
    scaleReferenceDiameterPx?: number;
  },
): { width: number; height: number } | null {
  const metrics = resolution?.metrics;
  if (!metrics) return null;

  const visibleDiameterPx = resolveBeadVisibleDiameterPx(metrics);
  if (visibleDiameterPx <= 0) return null;

  const scaleDenom =
    options.scaleReferenceDiameterPx && options.scaleReferenceDiameterPx > 0
      ? options.scaleReferenceDiameterPx
      : visibleDiameterPx;
  const uniformScale = options.targetDiameterPx / scaleDenom;
  const wScale = options.widthScale ?? 1;
  const hScale = options.heightScale ?? 1;

  if (options.preferProcessedCanvas) {
    const processed = effectiveProcessedCanvas(metrics);
    if (processed.processedWidthPx <= 0 || processed.processedHeightPx <= 0) return null;

    return {
      width: processed.processedWidthPx * uniformScale * wScale,
      height: processed.processedHeightPx * uniformScale * hScale,
    };
  }

  const footprintW = metrics.visibleWidthPx;
  const footprintH = metrics.visibleHeightPx;
  if (footprintW <= 0 || footprintH <= 0) return null;

  return {
    width: footprintW * uniformScale * wScale,
    height: footprintH * uniformScale * hScale,
  };
}

/** Fraction of export canvas occupied by the visible silhouette (1 = no pad). */
export function beadExportSilhouetteFillRatio(
  metrics: BeadCropPhysicalMetrics | null | undefined,
): number | null {
  if (!metrics) return null;
  const visible = resolveBeadVisibleDiameterPx(metrics);
  const processed = effectiveProcessedCanvas(metrics);
  const processedMax = Math.max(processed.processedWidthPx, processed.processedHeightPx);
  if (visible <= 0 || processedMax <= 0) return null;
  return visible / processedMax;
}

/**
 * Resolve stored physical metrics without image processing.
 * Used by the bracelet builder at render time.
 */
export function resolveBeadPhysicalMetrics(
  config: BeadCropConfig | null | undefined,
): BeadCropMetricsResolution | null {
  if (!config?.imageWidth || !config.imageHeight) return null;

  if (config.version === BEAD_CROP_CONFIG_V2) {
    if (metricsValid(config.physicalMetrics)) {
      return {
        metrics: normalizePhysicalMetrics(config.physicalMetrics),
        source: "physicalMetrics",
        needsRecropReview: false,
      };
    }
    if (config.visualBounds && config.visualBounds.width > 0 && config.visualBounds.height > 0) {
      return {
        metrics: metricsFromNormBounds(config.visualBounds, config.imageWidth, config.imageHeight),
        source: "visualBounds",
        needsRecropReview: false,
      };
    }
    const points = getBeadCropPoints(config);
    const anchor = anchorBoundsNormFromPoints(points);
    if (anchor) {
      return {
        metrics: metricsFromNormBounds(anchor, config.imageWidth, config.imageHeight),
        source: "anchorEstimate",
        needsRecropReview: true,
      };
    }
    return null;
  }

  if (config.version === BEAD_CROP_CONFIG_V1 && config.crop) {
    const { width, height } = config.crop;
    if (width <= 0 || height <= 0) return null;
    const visibleWidthPx = width * config.imageWidth;
    const visibleHeightPx = height * config.imageHeight;
    return {
      metrics: normalizePhysicalMetrics({
        visibleWidthPx,
        visibleHeightPx,
        referenceDiameterPx: Math.max(visibleWidthPx, visibleHeightPx),
      }),
      source: "cropRect",
      needsRecropReview: true,
    };
  }

  return null;
}

/**
 * Metrics for bracelet rendering — prefers mask-based metadata; falls back to anchor
 * silhouette when processed export dims exist but mask metadata is missing.
 */
export function resolveBeadPhysicalMetricsForRender(
  config: BeadCropConfig | null | undefined,
): BeadCropMetricsResolution | null {
  const resolution = resolveBeadPhysicalMetrics(config);
  if (resolution && isReliableMetricsSource(resolution.source)) {
    return resolution;
  }

  if (config?.version === BEAD_CROP_CONFIG_V2) {
    const pm = config.physicalMetrics;
    const processedWidthPx = pm?.processedWidthPx;
    const processedHeightPx = pm?.processedHeightPx;
    if (pm && processedWidthPx && processedHeightPx) {
      if (metricsValid(pm)) {
        return {
          metrics: normalizePhysicalMetrics(pm),
          source: "physicalMetrics",
          needsRecropReview: false,
        };
      }
      if (config.visualBounds && config.visualBounds.width > 0 && config.visualBounds.height > 0) {
        const fromBounds = metricsFromNormBounds(
          config.visualBounds,
          config.imageWidth,
          config.imageHeight,
        );
        return {
          metrics: normalizePhysicalMetrics({
            ...fromBounds,
            processedWidthPx,
            processedHeightPx,
          }),
          source: "physicalMetrics",
          needsRecropReview: false,
        };
      }
    }
  }

  // Pair processed export dimensions with best available silhouette (incl. anchor when mask metadata missing).
  if (config?.version === BEAD_CROP_CONFIG_V2) {
    const audit = resolveBeadPhysicalMetrics(config);
    if (audit && resolveBeadVisibleDiameterPx(audit.metrics) > 0) {
      const pm = config.physicalMetrics;
      const processedWidthPx =
        pm?.processedWidthPx && pm?.processedHeightPx
          ? pm.processedWidthPx
          : audit.metrics.processedWidthPx;
      const processedHeightPx =
        pm?.processedWidthPx && pm?.processedHeightPx
          ? pm.processedHeightPx
          : audit.metrics.processedHeightPx;

      const withProcessed =
        processedWidthPx && processedHeightPx
          ? { ...audit.metrics, processedWidthPx, processedHeightPx }
          : {
              ...audit.metrics,
              ...predictProcessedExportDimensions(
                audit.metrics.visibleWidthPx,
                audit.metrics.visibleHeightPx,
              ),
            };

      return {
        metrics: normalizePhysicalMetrics(withProcessed),
        source: audit.source,
        needsRecropReview: audit.needsRecropReview,
      };
    }
  }

  return null;
}

/** @deprecated Use resolveBeadPhysicalMetrics */
export function deriveBeadPhysicalMetrics(
  config: BeadCropConfig | null | undefined,
): BeadCropPhysicalMetrics | null {
  return resolveBeadPhysicalMetrics(config)?.metrics ?? null;
}

/** Normalized silhouette for clip / object-position (shape only — not physical size). */
export function deriveBeadVisualBoundsNorm(
  config: BeadCropConfig | null | undefined,
): BeadVisualBoundsStored {
  const unit: BeadVisualBoundsStored = {
    width: 1,
    height: 1,
    centerX: 0.5,
    centerY: 0.5,
  };
  if (!config?.imageWidth || !config.imageHeight) return unit;

  if (config.version === BEAD_CROP_CONFIG_V2) {
    if (config.visualBounds && config.visualBounds.width > 0 && config.visualBounds.height > 0) {
      return config.visualBounds;
    }
    const metrics = resolveBeadPhysicalMetrics(config);
    if (metrics) {
      return {
        width: metrics.metrics.visibleWidthPx / config.imageWidth,
        height: metrics.metrics.visibleHeightPx / config.imageHeight,
        centerX: config.visualBounds?.centerX ?? 0.5,
        centerY: config.visualBounds?.centerY ?? 0.5,
      };
    }
    const anchor = anchorBoundsNormFromPoints(getBeadCropPoints(config));
    return anchor ?? unit;
  }

  if (config.version === BEAD_CROP_CONFIG_V1 && config.crop) {
    const { x, y, width, height } = config.crop;
    if (width <= 0 || height <= 0) return unit;
    return {
      width,
      height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  }

  return unit;
}

/**
 * Refresh stored physical metrics from crop config (path/crop rect only — no image analysis).
 * Used by admin tools for legacy assets.
 */
export function refreshBeadCropStoredMetrics(
  config: BeadCropConfig,
): BeadCropConfig | null {
  const resolution = resolveBeadPhysicalMetrics(config);
  if (!resolution) return null;

  const m = normalizePhysicalMetrics(resolution.metrics);

  if (config.version === BEAD_CROP_CONFIG_V2) {
    return {
      ...config,
      physicalMetrics: m,
      updatedAt: Date.now(),
    };
  }

  return {
    ...config,
    updatedAt: Date.now(),
  };
}
