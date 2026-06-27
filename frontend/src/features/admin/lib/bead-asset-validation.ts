import {
  beadExportSilhouetteFillRatio,
  getBeadCropPoints,
  resolveBeadPhysicalMetrics,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import { hasDistinctProcessedAsset } from "@/render/bead-crop/apply-crop";
import { resolveBeadCropConfig } from "@/render/bead-crop/resolve-bead-crop-config";

export type BeadAssetValidationStatus = "excellent" | "good" | "needs-adjustment";

export interface BeadAssetValidationResult {
  status: BeadAssetValidationStatus;
  statusLabel: string;
  visibleFootprintPct: number | null;
  canvasUsagePct: number | null;
  imageCentered: boolean | null;
  aspectRatio: number | null;
  aspectRatioLabel: string | null;
  hasProcessedAsset: boolean;
  hasCropPath: boolean;
  issues: string[];
}

const TARGET_FOOTPRINT_MIN = 0.82;
const TARGET_FOOTPRINT_MAX = 0.96;
const GOOD_FOOTPRINT_MIN = 0.72;
const GOOD_FOOTPRINT_MAX = 0.98;
const CENTER_TOLERANCE = 0.06;

function centerOffsetFromConfig(config: BeadCropConfig): number | null {
  if (!config.imageWidth || !config.imageHeight) return null;
  const resolution = resolveBeadPhysicalMetrics(config);
  const metrics = resolution?.metrics;
  if (!metrics) return null;

  const visibleW = metrics.visibleWidthPx;
  const visibleH = metrics.visibleHeightPx;
  if (visibleW <= 0 || visibleH <= 0) return null;

  const points = getBeadCropPoints(config);
  if (points.length >= 3) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return Math.max(Math.abs(cx - 0.5), Math.abs(cy - 0.5));
  }

  if (config.visualBounds) {
    return Math.max(
      Math.abs(config.visualBounds.centerX - 0.5),
      Math.abs(config.visualBounds.centerY - 0.5),
    );
  }

  return null;
}

function deriveStatus(
  footprint: number | null,
  centered: boolean | null,
  hasProcessed: boolean,
  hasCrop: boolean,
): BeadAssetValidationStatus {
  if (!hasCrop) return "needs-adjustment";
  if (!hasProcessed) return "needs-adjustment";

  const footprintOk =
    footprint != null && footprint >= TARGET_FOOTPRINT_MIN && footprint <= TARGET_FOOTPRINT_MAX;
  const footprintGood =
    footprint != null && footprint >= GOOD_FOOTPRINT_MIN && footprint <= GOOD_FOOTPRINT_MAX;
  const centeredOk = centered !== false;

  if (footprintOk && centeredOk) return "excellent";
  if (footprintGood && centeredOk) return "good";
  return "needs-adjustment";
}

function statusLabel(status: BeadAssetValidationStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    default:
      return "Needs Adjustment";
  }
}

/** Metadata-only validation — no pixel inspection. */
export function validateBeadAsset(
  bead: Pick<BeadLibraryEntry, "cropConfig" | "processedImage" | "image" | "originalImage">,
  draftConfig?: BeadCropConfig | null,
): BeadAssetValidationResult {
  const config = draftConfig ?? resolveBeadCropConfig(bead as BeadLibraryEntry);
  const hasCrop = Boolean(config && getBeadCropPoints(config).length >= 3);
  const hasProcessed = hasDistinctProcessedAsset(bead as BeadLibraryEntry);
  const issues: string[] = [];

  if (!hasCrop) issues.push("Draw and save a crop path.");
  if (!hasProcessed) issues.push("Export a processed asset (WebP/AVIF).");

  const resolution = config ? resolveBeadPhysicalMetrics(config) : null;
  const metrics = resolution?.metrics ?? null;
  const fillRatio = beadExportSilhouetteFillRatio(metrics);
  const visibleFootprintPct = fillRatio != null ? Math.round(fillRatio * 1000) / 10 : null;
  const canvasUsagePct = visibleFootprintPct;

  const centerOffset = config ? centerOffsetFromConfig(config) : null;
  const imageCentered = centerOffset != null ? centerOffset <= CENTER_TOLERANCE : null;
  if (imageCentered === false) issues.push("Bead silhouette is off-center in the export canvas.");

  if (visibleFootprintPct != null && visibleFootprintPct < GOOD_FOOTPRINT_MIN * 100) {
    issues.push("Visible footprint is small — trim excess transparent margins.");
  }
  if (visibleFootprintPct != null && visibleFootprintPct > GOOD_FOOTPRINT_MAX * 100) {
    issues.push("Bead fills nearly the entire canvas — leave a small margin.");
  }

  let aspectRatio: number | null = null;
  let aspectRatioLabel: string | null = null;
  if (metrics?.processedWidthPx && metrics.processedHeightPx) {
    aspectRatio = metrics.processedWidthPx / metrics.processedHeightPx;
    aspectRatioLabel = `${metrics.processedWidthPx}×${metrics.processedHeightPx}`;
  }

  const status = deriveStatus(fillRatio, imageCentered, hasProcessed, hasCrop);

  return {
    status,
    statusLabel: statusLabel(status),
    visibleFootprintPct,
    canvasUsagePct,
    imageCentered,
    aspectRatio,
    aspectRatioLabel,
    hasProcessedAsset: hasProcessed,
    hasCropPath: hasCrop,
    issues,
  };
}
