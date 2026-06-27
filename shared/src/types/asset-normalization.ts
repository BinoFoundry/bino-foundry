import type { BeadDeliveryUrls } from "./bead-crop.js";
import { computeMmGroupNormalizationFactor } from "./mm-group-normalization.js";

/** Max canvas edge for normalized strand exports (builder renders ~55px at 3× dpr). */
export const BEAD_NORMALIZED_EXPORT_MAX_CANVAS_PX = 512;

/** Absolute px tolerance when verifying baked visible diameter on export. */
export const NORMALIZED_EXPORT_DIAMETER_TOLERANCE_PX = 5;

/** Relative tolerance (1%) for anti-aliasing / canvas rounding on export verify. */
export const NORMALIZED_EXPORT_DIAMETER_TOLERANCE_RATIO = 0.01;

/** True when measured export footprint matches the target group reference within tolerance. */
export function normalizedExportDiameterMatchesTarget(
  measuredPx: number,
  targetPx: number,
): boolean {
  if (!Number.isFinite(measuredPx) || !Number.isFinite(targetPx) || targetPx <= 0) {
    return false;
  }
  const delta = Math.abs(measuredPx - targetPx);
  if (delta <= NORMALIZED_EXPORT_DIAMETER_TOLERANCE_PX) return true;
  return delta / targetPx <= NORMALIZED_EXPORT_DIAMETER_TOLERANCE_RATIO;
}

/** Scale export dimensions down when the crop canvas would be unnecessarily large. */
export function capExportCanvasDimensions(
  width: number,
  height: number,
  maxEdge = BEAD_NORMALIZED_EXPORT_MAX_CANVAS_PX,
): { width: number; height: number; downscale: number } {
  const maxSide = Math.max(width, height, 1);
  if (maxSide <= maxEdge) return { width, height, downscale: 1 };
  const downscale = maxEdge / maxSide;
  return {
    width: Math.max(1, Math.ceil(width * downscale)),
    height: Math.max(1, Math.ceil(height * downscale)),
    downscale,
  };
}

/** Scale factor to bake group reference visible diameter into an export (uniform, aspect preserved). */
export function normalizedExportContentScale(
  groupReferenceVisibleDiameterPx: number,
  assetVisibleDiameterPx: number,
): number {
  const factor = computeMmGroupNormalizationFactor(
    groupReferenceVisibleDiameterPx,
    assetVisibleDiameterPx,
  );
  return factor;
}

export interface BeadNormalizedExportRecord {
  normalizedProcessedImageUrl: string;
  normalizedDeliveryUrls?: BeadDeliveryUrls | null;
  normalizedVisibleDiameterPx: number;
  groupReferenceDiameterPx: number;
}

export function isNormalizedExportCurrent(
  record: {
    normalizedVisibleDiameterPx?: number | null;
    groupReferenceDiameterPx: number;
  },
  epsilon = 0.5,
): boolean {
  const baked = record.normalizedVisibleDiameterPx;
  if (baked == null || !Number.isFinite(baked) || baked <= 0) return false;
  return Math.abs(baked - record.groupReferenceDiameterPx) <= epsilon;
}

export interface NormalizedExportFreshnessInput {
  sizeMm: number;
  groupReferenceDiameterPx: number;
  assetVisibleDiameterPx: number;
  normalizedVisibleDiameterPx?: number | null;
  storedAssetVisibleDiameterPx?: number | null;
  needsNormalizedReexport?: boolean;
  cropUpdatedAt?: number | null;
  normalizedSavedAt?: number | null;
}

/** True when save-time re-export is required for this size junction. */
export function needsNormalizedExportRegeneration(input: NormalizedExportFreshnessInput): boolean {
  if (input.needsNormalizedReexport) return true;
  if (!input.normalizedVisibleDiameterPx || input.normalizedVisibleDiameterPx <= 0) return true;
  if (
    !isNormalizedExportCurrent({
      normalizedVisibleDiameterPx: input.normalizedVisibleDiameterPx,
      groupReferenceDiameterPx: input.groupReferenceDiameterPx,
    })
  ) {
    return true;
  }
  const storedVisible = input.storedAssetVisibleDiameterPx;
  if (
    storedVisible != null &&
    storedVisible > 0 &&
    Math.abs(storedVisible - input.assetVisibleDiameterPx) > 0.5
  ) {
    return true;
  }
  if (
    input.cropUpdatedAt &&
    input.normalizedSavedAt &&
    input.cropUpdatedAt > input.normalizedSavedAt
  ) {
    return true;
  }
  return false;
}
