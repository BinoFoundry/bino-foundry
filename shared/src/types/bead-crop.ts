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
  options?: Partial<Pick<BeadCropConfigV2, "processedUrl" | "scale" | "detection">>,
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
