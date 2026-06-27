import {
  exportNormalizedBeadBlobs,
  computeBeadPhysicalMetricsForSave,
} from "@/render/bead-crop";
import { beadLibrarySizesApi } from "@/services/api/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import {
  getBeadCropPoints,
  isBeadCropConfigValid,
  needsNormalizedExportRegeneration,
  normalizedExportDiameterMatchesTarget,
  type BeadDeliveryUrls,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";

import {
  blobMatchesRemoteAsset,
  uploadValidatedImage,
  validateUploadFile,
} from "./upload-pipeline";

export interface NormalizedSizeTarget {
  sizeMm: number;
  groupReferenceDiameterPx: number;
}

export type NormalizedExportOutcome = "saved" | "unchanged" | "reference" | "failed";

export interface NormalizedExportItemResult {
  sizeMm: number;
  normalizedVisibleDiameterPx: number;
  outcome: NormalizedExportOutcome;
  reason: string;
  pipelineStep: string;
  error?: string;
}

export interface NormalizedJunctionExportInput {
  libraryId: string;
  config: BeadCropConfig;
  target: NormalizedSizeTarget;
  assetVisibleDiameterPx: number;
  isGroupReference: boolean;
  needsExport: boolean;
  existingOffer?: BeadLibrarySizeOffer;
}

export interface SaveNormalizedExportsOptions {
  /** Skip AVIF uploads (batch regen — bucket may reject image/avif). */
  batchMode?: boolean;
  /** Existing junction rows for hash dedupe and metadata-only saves. */
  existingOffers?: BeadLibrarySizeOffer[];
}

export function resolveNormalizedSizeTargets(
  enabledSizeMms: number[],
  beadSizes: BeadSizeEntry[],
  assetVisibleDiameterPx: number,
): NormalizedSizeTarget[] {
  return enabledSizeMms
    .map((sizeMm) => {
      const groupRef = beadSizes.find((s) => s.sizeMm === sizeMm)?.groupReferenceDiameterPx;
      const reference =
        groupRef && groupRef > 0 ? groupRef : assetVisibleDiameterPx > 0 ? assetVisibleDiameterPx : null;
      return reference ? { sizeMm, groupReferenceDiameterPx: reference } : null;
    })
    .filter((t): t is NormalizedSizeTarget => t != null);
}

/** Keep cached group references — only return junctions that need a new normalized export. */
export function filterStaleNormalizationTargets(
  targets: NormalizedSizeTarget[],
  existingOffers: BeadLibrarySizeOffer[],
  assetVisibleDiameterPx: number,
  cropUpdatedAt?: number | null,
): NormalizedSizeTarget[] {
  return targets.filter((target) => {
    const offer = existingOffers.find((o) => o.sizeMm === target.sizeMm);
    if (!offer) return true;
    const normalizedSavedAt = offer.updatedAt ? Date.parse(offer.updatedAt) : null;
    return needsNormalizedExportRegeneration({
      sizeMm: target.sizeMm,
      groupReferenceDiameterPx: target.groupReferenceDiameterPx,
      assetVisibleDiameterPx,
      normalizedVisibleDiameterPx: offer.normalizedVisibleDiameterPx,
      storedAssetVisibleDiameterPx: offer.assetVisibleDiameterPx,
      needsNormalizedReexport: offer.needsNormalizedReexport,
      cropUpdatedAt: cropUpdatedAt ?? null,
      normalizedSavedAt: Number.isFinite(normalizedSavedAt) ? normalizedSavedAt : null,
    });
  });
}

export function assetVisibleDiameterFromConfig(config: BeadCropConfig): number {
  const points = getBeadCropPoints(config);
  const metrics =
    config.physicalMetrics ??
    computeBeadPhysicalMetricsForSave(config.imageWidth, config.imageHeight, points);
  if (!metrics) return 0;
  return Math.max(metrics.visibleWidthPx, metrics.visibleHeightPx);
}

async function uploadNormalizedWebp(
  blob: Blob,
  prefix: string,
): Promise<{ canonicalUrl: string; deliveryUrls: BeadDeliveryUrls }> {
  const file = new File([blob], `${prefix}.webp`, { type: "image/webp" });
  const validationError = validateUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const imageUrl = await uploadValidatedImage(file);
  return {
    canonicalUrl: imageUrl,
    deliveryUrls: { webp: imageUrl },
  };
}

function existingOfferForTarget(
  offers: BeadLibrarySizeOffer[] | undefined,
  sizeMm: number,
): BeadLibrarySizeOffer | undefined {
  return offers?.find((o) => o.sizeMm === sizeMm);
}

function junctionNeedsExport(
  target: NormalizedSizeTarget,
  assetVisibleDiameterPx: number,
  existing: BeadLibrarySizeOffer | undefined,
  cropUpdatedAt: number | null | undefined,
  force: boolean,
): boolean {
  if (force) return true;
  if (!existing) return true;
  const normalizedSavedAt = existing.updatedAt ? Date.parse(existing.updatedAt) : null;
  return needsNormalizedExportRegeneration({
    sizeMm: target.sizeMm,
    groupReferenceDiameterPx: target.groupReferenceDiameterPx,
    assetVisibleDiameterPx,
    normalizedVisibleDiameterPx: existing.normalizedVisibleDiameterPx,
    storedAssetVisibleDiameterPx: existing.assetVisibleDiameterPx,
    needsNormalizedReexport: existing.needsNormalizedReexport,
    cropUpdatedAt: cropUpdatedAt ?? null,
    normalizedSavedAt: Number.isFinite(normalizedSavedAt) ? normalizedSavedAt : null,
  });
}

async function persistNormalizedJunction(
  libraryId: string,
  sizeMm: number,
  normalizedProcessedImageUrl: string,
  normalizedVisibleDiameterPx: number,
  normalizedDeliveryUrls?: BeadDeliveryUrls | null,
): Promise<void> {
  await beadLibrarySizesApi.saveNormalizedExports(libraryId, [
    {
      sizeMm,
      normalizedProcessedImageUrl,
      normalizedDeliveryUrls: normalizedDeliveryUrls ?? { webp: normalizedProcessedImageUrl },
      normalizedVisibleDiameterPx,
    },
  ]);
}

/** Process one library×size junction — always returns a single final outcome. */
export async function processNormalizedJunctionExport(
  input: NormalizedJunctionExportInput,
): Promise<NormalizedExportItemResult> {
  const { libraryId, config, target, assetVisibleDiameterPx, isGroupReference, needsExport, existingOffer } =
    input;
  const existing = existingOffer;

  if (!needsExport) {
    const existingUrl = existing?.normalizedProcessedImageUrl?.trim();
    const visiblePx =
      existing?.normalizedVisibleDiameterPx && existing.normalizedVisibleDiameterPx > 0
        ? existing.normalizedVisibleDiameterPx
        : target.groupReferenceDiameterPx;

    if (isGroupReference) {
      if (existingUrl) {
        await persistNormalizedJunction(
          libraryId,
          target.sizeMm,
          existingUrl,
          visiblePx,
          existing?.normalizedDeliveryUrls,
        );
      }
      return {
        sizeMm: target.sizeMm,
        normalizedVisibleDiameterPx: visiblePx,
        outcome: "reference",
        reason: "Already matches largest visible footprint",
        pipelineStep: "assign-reference",
      };
    }

    if (existingUrl) {
      await persistNormalizedJunction(
        libraryId,
        target.sizeMm,
        existingUrl,
        visiblePx,
        existing?.normalizedDeliveryUrls,
      );
    }
    return {
      sizeMm: target.sizeMm,
      normalizedVisibleDiameterPx: visiblePx,
      outcome: "unchanged",
      reason: "Already normalized",
      pipelineStep: "metadata-only",
    };
  }

  try {
    const blobs = await exportNormalizedBeadBlobs(config, {
      targetVisibleDiameterPx: target.groupReferenceDiameterPx,
    });

    if (!blobs.webp.size) {
      return {
        sizeMm: target.sizeMm,
        normalizedVisibleDiameterPx: 0,
        outcome: "failed",
        reason: "Export produced an empty WebP file",
        pipelineStep: "export-bitmap",
        error: "Export produced an empty WebP file",
      };
    }

    if (!blobs.scaleApplied) {
      const msg = `Normalization scale not applied (measured ${blobs.measuredVisibleDiameterPx.toFixed(1)}px, target ${target.groupReferenceDiameterPx.toFixed(1)}px)`;
      return {
        sizeMm: target.sizeMm,
        normalizedVisibleDiameterPx: blobs.measuredVisibleDiameterPx,
        outcome: "failed",
        reason: msg,
        pipelineStep: "validate-scale",
        error: msg,
      };
    }

    const existingUrl = existing?.normalizedProcessedImageUrl?.trim();
    const footprintMatchesTarget = normalizedExportDiameterMatchesTarget(
      blobs.measuredVisibleDiameterPx,
      target.groupReferenceDiameterPx,
    );
    if (
      existingUrl &&
      footprintMatchesTarget &&
      (await blobMatchesRemoteAsset(blobs.webp, existingUrl))
    ) {
      await persistNormalizedJunction(
        libraryId,
        target.sizeMm,
        existingUrl,
        blobs.measuredVisibleDiameterPx,
        existing?.normalizedDeliveryUrls ?? { webp: existingUrl },
      );
      if (isGroupReference) {
        return {
          sizeMm: target.sizeMm,
          normalizedVisibleDiameterPx: blobs.measuredVisibleDiameterPx,
          outcome: "reference",
          reason: "Largest visible bead",
          pipelineStep: "export-bitmap",
        };
      }
      return {
        sizeMm: target.sizeMm,
        normalizedVisibleDiameterPx: blobs.measuredVisibleDiameterPx,
        outcome: "unchanged",
        reason: "Already normalized",
        pipelineStep: "export-bitmap",
      };
    }

    const uploads = await uploadNormalizedWebp(
      blobs.webp,
      `bead-normalized-${libraryId}-${target.sizeMm}mm`,
    );

    await persistNormalizedJunction(
      libraryId,
      target.sizeMm,
      uploads.canonicalUrl,
      blobs.measuredVisibleDiameterPx,
      uploads.deliveryUrls,
    );

    return {
      sizeMm: target.sizeMm,
      normalizedVisibleDiameterPx: blobs.measuredVisibleDiameterPx,
      outcome: "saved",
      reason: "Bitmap regenerated",
      pipelineStep: "save-asset",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Normalized export failed for ${libraryId} @ ${target.sizeMm}mm:`, message);
    return {
      sizeMm: target.sizeMm,
      normalizedVisibleDiameterPx: 0,
      outcome: "failed",
      reason: message,
      pipelineStep: "export-or-upload",
      error: message,
    };
  }
}

export function junctionNeedsNormalizedExport(
  target: NormalizedSizeTarget,
  assetVisibleDiameterPx: number,
  existingOffers: BeadLibrarySizeOffer[],
  cropUpdatedAt: number | null | undefined,
  force: boolean,
): boolean {
  return junctionNeedsExport(
    target,
    assetVisibleDiameterPx,
    existingOfferForTarget(existingOffers, target.sizeMm),
    cropUpdatedAt,
    force,
  );
}

/**
 * Export, upload (WebP only in batch), and persist stale per-mm-group normalized assets.
 * Processes sequentially — never floods POST /api/upload.
 */
export async function saveNormalizedExportsForLibrary(
  libraryId: string,
  config: BeadCropConfig,
  targets: NormalizedSizeTarget[],
  options?: SaveNormalizedExportsOptions,
): Promise<NormalizedExportItemResult[]> {
  if (!targets.length) return [];

  const results: NormalizedExportItemResult[] = [];
  const assetVisible = assetVisibleDiameterFromConfig(config);

  for (const target of targets) {
    const existing = existingOfferForTarget(options?.existingOffers, target.sizeMm);
    const isGroupReference = normalizedExportDiameterMatchesTarget(
      assetVisible,
      target.groupReferenceDiameterPx,
    );
    const needsExport = junctionNeedsExport(
      target,
      assetVisible,
      existing,
      config.updatedAt,
      false,
    );

    const result = await processNormalizedJunctionExport({
      libraryId,
      config,
      target,
      assetVisibleDiameterPx: assetVisible,
      isGroupReference,
      needsExport,
      existingOffer: existing,
    });
    results.push(result);
  }

  return results;
}

/** @deprecated Single-bead saves handle normalization inline — no catalogue-wide regen. */
export function scheduleBackgroundNormalizedRegen(): void {
  // Intentionally no-op — batch regen belongs on Bead sizes admin only.
}
