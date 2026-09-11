import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { beadLibrarySizesApi } from "@/services/api/bead-library-sizes";
import { beadSizesApi } from "@/services/api/bead-sizes";
import { beadsApi } from "@/services/api/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import { isBeadCropConfigValid, type BeadCropConfig } from "@bino-foundry/shared/types";

import {
  assetVisibleDiameterFromConfig,
  junctionNeedsNormalizedExport,
  processNormalizedJunctionExport,
  resolveNormalizedSizeTargets,
  type NormalizedExportItemResult,
  type NormalizedSizeTarget,
} from "./normalized-bead-export";
import {
  assertRegenSummaryConsistency,
  formatRegenSummaryText,
  isGroupReferenceBead,
  regenRecordForSkipped,
  regenRecordFromExport,
  type NormalizedRegenAssetRecord,
  type NormalizedRegenFinalStatus,
  type NormalizedRegenSummary,
} from "./normalized-regen-pipeline";

export type NormalizedRegenScope = "all" | "bead-size" | "category" | "selected";

export interface NormalizedRegenFilter {
  scope: NormalizedRegenScope;
  /** Required when scope is `bead-size`. */
  sizeMm?: number;
  /** Required when scope is `category`. */
  beadTypeId?: string;
  /** Required when scope is `selected`. */
  libraryIds?: string[];
  /** When true, every junction attempts export even if metadata is fresh. */
  force?: boolean;
  /** When true, ineligible junctions (invalid crop, etc.) appear as SKIPPED rows. */
  includeIneligible?: boolean;
}

/** One catalogue junction (library × size mm) — every item receives exactly one final status. */
export interface NormalizedRegenQueueItem {
  libraryId: string;
  libraryName: string;
  beadTypeName: string;
  sizeMm: number;
  offerId: string | null;
  cropConfig: BeadCropConfig | null;
  skipReason: string | null;
  pipelineStep: string;
  target: NormalizedSizeTarget | null;
  assetVisibleDiameterPx: number;
  isGroupReference: boolean;
  needsExport: boolean;
  existingOffers: BeadLibrarySizeOffer[];
}

/** @deprecated Use NormalizedRegenQueueItem — kept for callers that batch by library. */
export interface NormalizedRegenWorkItem {
  libraryId: string;
  libraryName: string;
  beadTypeName: string;
  sizeMm: number;
  cropConfig: BeadCropConfig;
  targets: NormalizedSizeTarget[];
  existingOffers: BeadLibrarySizeOffer[];
}

export type NormalizedRegenJobStatus =
  | "idle"
  | "preparing"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type RefreshBeadAssetsPhase =
  | "preparing"
  | "updating-sizes"
  | "generating-images"
  | "finalizing"
  | "completed";

export interface NormalizedRegenJobProgress {
  status: NormalizedRegenJobStatus;
  done: number;
  total: number;
  saved: number;
  reference: number;
  unchanged: number;
  skipped: number;
  failed: number;
  /** @deprecated Use `saved`. */
  succeeded: number;
  currentLabel: string | null;
  etaMs: number | null;
  errorMessage: string | null;
  summary: NormalizedRegenSummary | null;
  phase?: RefreshBeadAssetsPhase;
}

/** One asset at a time — avoids upload flooding and HTTP 429. */
export const NORMALIZED_REGEN_BATCH_SIZE = 1;
const ETA_SAMPLE_SIZE = 12;
const INTER_ITEM_DELAY_MS = 16;
const CROP_FETCH_CONCURRENCY = 8;

function libraryPassesScope(
  library: BeadLibraryEntry,
  filter: NormalizedRegenFilter,
): boolean {
  switch (filter.scope) {
    case "all":
      return true;
    case "category":
      return Boolean(filter.beadTypeId && library.beadTypeId === filter.beadTypeId);
    case "selected":
      return Boolean(filter.libraryIds?.includes(library.id));
    case "bead-size":
      return true;
    default:
      return false;
  }
}

function offersForLibraryFilter(
  libraryOffers: BeadLibrarySizeOffer[],
  filter: NormalizedRegenFilter,
): BeadLibrarySizeOffer[] {
  if (filter.scope === "bead-size" && filter.sizeMm != null) {
    return libraryOffers.filter((o) => o.sizeMm === filter.sizeMm);
  }
  return libraryOffers;
}

function exportOutcomeToStatus(outcome: NormalizedExportItemResult["outcome"]): NormalizedRegenFinalStatus {
  switch (outcome) {
    case "saved":
      return "SAVED";
    case "reference":
      return "REFERENCE";
    case "unchanged":
      return "UNCHANGED";
    case "failed":
      return "FAILED";
  }
}

function recordFromExportResult(
  item: NormalizedRegenQueueItem,
  result: NormalizedExportItemResult,
): NormalizedRegenAssetRecord {
  return regenRecordFromExport({
    libraryId: item.libraryId,
    libraryName: item.libraryName,
    sizeMm: item.sizeMm,
    offerId: item.offerId,
    status: exportOutcomeToStatus(result.outcome),
    reason: result.reason,
    pipelineStep: result.pipelineStep,
    assetVisibleDiameterPx: item.assetVisibleDiameterPx,
    groupReferenceDiameterPx: item.target?.groupReferenceDiameterPx ?? 0,
    isGroupReference: item.isGroupReference,
  });
}

/**
 * Fill in crop configs for the beads a run will touch.
 *
 * The catalogue list omits them on purpose — polygon payloads are large, so the
 * API only returns a crop config when a bead is fetched by id. The queue
 * builder needs one for every bead and silently drops those without, which
 * meant the batch refresh completed instantly having processed nothing at all.
 *
 * Every bead holding an offer is fetched, not only those with outstanding work:
 * the run asserts that it visited every junction whose factor was refreshed, and
 * a bead left unhydrated silently drops out of that count. Already-exported
 * beads still cost a request, but they are recorded as unchanged rather than
 * vanishing — which is the whole point of the coverage check.
 */
export async function hydrateCropConfigs(
  libraries: BeadLibraryEntry[],
  offers: BeadLibrarySizeOffer[],
  options?: { signal?: AbortSignal },
): Promise<BeadLibraryEntry[]> {
  const withOffers = new Set(offers.map((o) => o.beadLibraryId));
  const needed = libraries.filter((l) => withOffers.has(l.id) && !l.cropConfig);
  if (!needed.length) return libraries;

  const fetched = new Map<string, BeadLibraryEntry>();
  for (let i = 0; i < needed.length; i += CROP_FETCH_CONCURRENCY) {
    if (options?.signal?.aborted) break;
    const batch = needed.slice(i, i + CROP_FETCH_CONCURRENCY);
    const rows = await Promise.all(
      // One bead failing to load must not sink the whole run; it simply stays
      // unhydrated and is reported as ineligible like any other bad crop.
      batch.map((l) => beadsApi.getLibrary(l.id).catch(() => null)),
    );
    for (const row of rows) if (row?.cropConfig) fetched.set(row.id, row);
  }

  return libraries.map((l) => fetched.get(l.id) ?? l);
}

export function buildNormalizedRegenQueue(
  libraries: BeadLibraryEntry[],
  offers: BeadLibrarySizeOffer[],
  beadSizes: BeadSizeEntry[],
  beadTypes: BeadTypeEntry[],
  filter: NormalizedRegenFilter,
): NormalizedRegenQueueItem[] {
  const force = filter.force === true;
  const includeIneligible = filter.includeIneligible === true;
  const typeName = (id: string) => beadTypes.find((t) => t.id === id)?.name ?? "—";
  const items: NormalizedRegenQueueItem[] = [];

  const libraryPool =
    filter.scope === "selected" && filter.libraryIds?.length
      ? libraries.filter((l) => filter.libraryIds!.includes(l.id))
      : libraries.filter((l) => libraryPassesScope(l, filter));

  for (const library of libraryPool) {
    const libraryOffers = sizesForLibrary(offers, library.id);
    const scopedOffers = offersForLibraryFilter(libraryOffers, filter);
    if (!scopedOffers.length) continue;

    const cropConfig = library.cropConfig;
    if (!cropConfig || !isBeadCropConfigValid(cropConfig)) {
      if (includeIneligible) {
        for (const offer of scopedOffers) {
          items.push({
            libraryId: library.id,
            libraryName: library.name,
            beadTypeName: typeName(library.beadTypeId),
            sizeMm: offer.sizeMm,
            offerId: offer.id,
            cropConfig: null,
            skipReason: "Invalid or missing crop configuration",
            pipelineStep: "validate-crop",
            target: null,
            assetVisibleDiameterPx: 0,
            isGroupReference: false,
            needsExport: false,
            existingOffers: libraryOffers,
          });
        }
      }
      continue;
    }

    if (!cropConfig.originalUrl?.trim() && !library.originalImage?.trim()) {
      if (includeIneligible) {
        for (const offer of scopedOffers) {
          items.push({
            libraryId: library.id,
            libraryName: library.name,
            beadTypeName: typeName(library.beadTypeId),
            sizeMm: offer.sizeMm,
            offerId: offer.id,
            cropConfig: null,
            skipReason: "Missing original image URL",
            pipelineStep: "validate-crop",
            target: null,
            assetVisibleDiameterPx: 0,
            isGroupReference: false,
            needsExport: false,
            existingOffers: libraryOffers,
          });
        }
      }
      continue;
    }

    const config: BeadCropConfig = cropConfig.originalUrl
      ? cropConfig
      : { ...cropConfig, originalUrl: library.originalImage!.trim() };

    const assetVisible = assetVisibleDiameterFromConfig(config);

    for (const offer of scopedOffers) {
      const targets = resolveNormalizedSizeTargets([offer.sizeMm], beadSizes, assetVisible);
      const target = targets[0] ?? null;

      if (!target) {
        if (includeIneligible) {
          items.push({
            libraryId: library.id,
            libraryName: library.name,
            beadTypeName: typeName(library.beadTypeId),
            sizeMm: offer.sizeMm,
            offerId: offer.id,
            cropConfig: config,
            skipReason: "No group reference diameter for this size",
            pipelineStep: "resolve-group-reference",
            target: null,
            assetVisibleDiameterPx: assetVisible,
            isGroupReference: false,
            needsExport: false,
            existingOffers: libraryOffers,
          });
        }
        continue;
      }

      const isGroupReference = isGroupReferenceBead(assetVisible, target.groupReferenceDiameterPx);
      const needsExport = junctionNeedsNormalizedExport(
        target,
        assetVisible,
        libraryOffers,
        config.updatedAt,
        force,
      );

      items.push({
        libraryId: library.id,
        libraryName: library.name,
        beadTypeName: typeName(library.beadTypeId),
        sizeMm: offer.sizeMm,
        offerId: offer.id,
        cropConfig: config,
        skipReason: null,
        pipelineStep: "process-junction",
        target,
        assetVisibleDiameterPx: assetVisible,
        isGroupReference,
        needsExport,
        existingOffers: libraryOffers,
      });
    }
  }

  return items.sort(
    (a, b) => a.libraryName.localeCompare(b.libraryName) || a.sizeMm - b.sizeMm,
  );
}

/** @deprecated Use buildNormalizedRegenQueue. */
export function buildNormalizedRegenWorkItems(
  libraries: BeadLibraryEntry[],
  offers: BeadLibrarySizeOffer[],
  beadSizes: BeadSizeEntry[],
  beadTypes: BeadTypeEntry[],
  filter: NormalizedRegenFilter,
): NormalizedRegenWorkItem[] {
  return buildNormalizedRegenQueue(libraries, offers, beadSizes, beadTypes, filter)
    .filter((item): item is NormalizedRegenQueueItem & { cropConfig: BeadCropConfig; target: NormalizedSizeTarget } =>
      item.cropConfig != null && item.target != null && item.skipReason == null,
    )
    .map((item) => ({
      libraryId: item.libraryId,
      libraryName: item.libraryName,
      beadTypeName: item.beadTypeName,
      sizeMm: item.sizeMm,
      cropConfig: item.cropConfig,
      targets: [item.target],
      existingOffers: item.existingOffers,
    }));
}

export function countNormalizedRegenWorkItems(
  libraries: BeadLibraryEntry[],
  offers: BeadLibrarySizeOffer[],
  beadSizes: BeadSizeEntry[],
  beadTypes: BeadTypeEntry[],
  filter: NormalizedRegenFilter,
): number {
  return buildNormalizedRegenQueue(libraries, offers, beadSizes, beadTypes, filter).length;
}

function yieldToMain(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateEtaMs(completedDurations: number[], remaining: number): number | null {
  if (!completedDurations.length || remaining <= 0) return null;
  const sample = completedDurations.slice(-ETA_SAMPLE_SIZE);
  const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
  return Math.round(avg * remaining);
}

export function formatEtaMs(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `~${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `~${min}m ${rem}s` : `~${min}m`;
}

function tallyRecords(records: NormalizedRegenAssetRecord[]): Pick<
  NormalizedRegenJobProgress,
  "saved" | "reference" | "unchanged" | "skipped" | "failed" | "succeeded"
> {
  let saved = 0;
  let reference = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of records) {
    switch (r.status) {
      case "SAVED":
        saved += 1;
        break;
      case "REFERENCE":
        reference += 1;
        break;
      case "UNCHANGED":
        unchanged += 1;
        break;
      case "SKIPPED":
        skipped += 1;
        break;
      case "FAILED":
        failed += 1;
        break;
    }
  }

  return { saved, reference, unchanged, skipped, failed, succeeded: saved };
}

function makeProgress(
  partial: Partial<NormalizedRegenJobProgress> & { status: NormalizedRegenJobStatus },
  total: number,
): NormalizedRegenJobProgress {
  return {
    status: partial.status,
    done: partial.done ?? 0,
    total,
    saved: partial.saved ?? 0,
    reference: partial.reference ?? 0,
    unchanged: partial.unchanged ?? 0,
    skipped: partial.skipped ?? 0,
    failed: partial.failed ?? 0,
    succeeded: partial.succeeded ?? partial.saved ?? 0,
    currentLabel: partial.currentLabel ?? null,
    etaMs: partial.etaMs ?? null,
    errorMessage: partial.errorMessage ?? null,
    summary: partial.summary ?? null,
    phase: partial.phase,
  };
}

async function processQueueItem(item: NormalizedRegenQueueItem): Promise<NormalizedRegenAssetRecord> {
  if (item.skipReason) {
    return regenRecordForSkipped({
      libraryId: item.libraryId,
      libraryName: item.libraryName,
      sizeMm: item.sizeMm,
      offerId: item.offerId,
      reason: item.skipReason,
      pipelineStep: item.pipelineStep,
    });
  }

  if (!item.cropConfig || !item.target) {
    return regenRecordForSkipped({
      libraryId: item.libraryId,
      libraryName: item.libraryName,
      sizeMm: item.sizeMm,
      offerId: item.offerId,
      reason: "Missing crop or target configuration",
      pipelineStep: "validate-junction",
    });
  }

  const existingOffer = item.existingOffers.find((o) => o.sizeMm === item.sizeMm);
  const result = await processNormalizedJunctionExport({
    libraryId: item.libraryId,
    config: item.cropConfig,
    target: item.target,
    assetVisibleDiameterPx: item.assetVisibleDiameterPx,
    isGroupReference: item.isGroupReference,
    needsExport: item.needsExport,
    existingOffer,
  });

  return recordFromExportResult(item, result);
}

export interface RunNormalizedRegenJobOptions {
  items: NormalizedRegenQueueItem[];
  batchSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: NormalizedRegenJobProgress) => void;
  factorsRefreshed?: number;
  sizeGroupsProcessed?: number;
}

/** Process normalized exports sequentially — every junction receives exactly one final status. */
export async function runNormalizedAssetRegenJob(
  options: RunNormalizedRegenJobOptions,
): Promise<NormalizedRegenJobProgress> {
  const {
    items,
    batchSize = NORMALIZED_REGEN_BATCH_SIZE,
    signal,
    onProgress,
    factorsRefreshed = 0,
    sizeGroupsProcessed = 0,
  } = options;
  const total = items.length;
  const durations: number[] = [];
  const records: NormalizedRegenAssetRecord[] = [];

  const report = (
    partial: Partial<NormalizedRegenJobProgress> & { status: NormalizedRegenJobStatus },
  ): NormalizedRegenJobProgress => {
    const progress = makeProgress(partial, total);
    onProgress?.(progress);
    return progress;
  };

  if (!total) {
    const summary = assertRegenSummaryConsistency([], {
      sizeGroupsProcessed,
      factorsRefreshed,
    });
    return report({
      status: "completed",
      done: 0,
      saved: 0,
      reference: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      succeeded: 0,
      currentLabel: "Nothing to regenerate",
      etaMs: null,
      summary,
    });
  }

  let done = 0;
  let saved = 0;
  let reference = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  report({
    status: "running",
    done,
    saved,
    reference,
    unchanged,
    skipped,
    failed,
    succeeded: saved,
    currentLabel: "Starting…",
    etaMs: null,
  });

  for (let i = 0; i < items.length; i += batchSize) {
    if (signal?.aborted) {
      return report({
        status: "cancelled",
        done,
        saved,
        reference,
        unchanged,
        skipped,
        failed,
        succeeded: saved,
        currentLabel: null,
        etaMs: null,
        summary: null,
      });
    }

    const batch = items.slice(i, i + batchSize);
    for (const item of batch) {
      if (signal?.aborted) {
        return report({
          status: "cancelled",
          done,
          saved,
          reference,
          unchanged,
          skipped,
          failed,
          succeeded: saved,
          currentLabel: null,
          etaMs: null,
          summary: null,
        });
      }

      const label = `${item.libraryName} · ${item.sizeMm} mm`;
      report({
        status: "running",
        done,
        saved,
        reference,
        unchanged,
        skipped,
        failed,
        succeeded: saved,
        currentLabel: label,
        etaMs: estimateEtaMs(durations, total - done),
      });

      const started = performance.now();
      try {
        const record = await processQueueItem(item);
        records.push(record);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Regen failed for ${item.libraryId} @ ${item.sizeMm}mm:`, err);
        records.push(
          regenRecordFromExport({
            libraryId: item.libraryId,
            libraryName: item.libraryName,
            sizeMm: item.sizeMm,
            offerId: item.offerId,
            status: "FAILED",
            reason: message,
            pipelineStep: "process-junction",
            assetVisibleDiameterPx: item.assetVisibleDiameterPx,
            groupReferenceDiameterPx: item.target?.groupReferenceDiameterPx ?? 0,
            isGroupReference: item.isGroupReference,
          }),
        );
      }
      durations.push(performance.now() - started);
      done += 1;

      const tally = tallyRecords(records);
      saved = tally.saved;
      reference = tally.reference;
      unchanged = tally.unchanged;
      skipped = tally.skipped;
      failed = tally.failed;

      report({
        status: "running",
        done,
        saved,
        reference,
        unchanged,
        skipped,
        failed,
        succeeded: saved,
        currentLabel: label,
        etaMs: estimateEtaMs(durations, total - done),
      });
    }

    await yieldToMain(INTER_ITEM_DELAY_MS);
  }

  const summary = assertRegenSummaryConsistency(records, {
    sizeGroupsProcessed,
    factorsRefreshed: factorsRefreshed || records.length,
  });

  // Recalculate can touch every size offer (e.g. 102) while the export queue only includes
  // libraries with a valid crop (e.g. 86). That is expected — do not fail a successful run.
  if (factorsRefreshed > 0 && summary.beadsProcessed !== factorsRefreshed) {
    console.warn(
      `[Normalized regen] Queue processed ${summary.beadsProcessed} junction(s); size-group recalculate refreshed ${factorsRefreshed} factor(s).`,
    );
  }

  if (records.length !== items.length) {
    const recordKeys = new Set(records.map((r) => `${r.libraryId}:${r.sizeMm}`));
    const missing = items.filter((item) => !recordKeys.has(`${item.libraryId}:${item.sizeMm}`));
    console.error(
      "[Normalized regen] Queue items without a final record:",
      missing.map((m) => ({
        assetId: m.offerId,
        slug: m.libraryId,
        beadName: m.libraryName,
        size: m.sizeMm,
        reason: m.skipReason ?? "No record emitted",
        pipelineStep: m.pipelineStep,
      })),
    );
    const detail = missing.length
      ? `Missing: ${missing.map((m) => m.libraryName).join(", ")}`
      : `${factorsRefreshed - summary.beadsProcessed} never entered the queue — ` +
        "usually beads whose crop data could not be loaded.";
    throw new Error(
      `Regeneration missing ${missing.length} queue result(s): ${missing.map((m) => m.libraryName).join(", ") || detail}`,
    );
  }

  return report({
    status: "completed",
    done,
    saved,
    reference,
    unchanged,
    skipped,
    failed,
    succeeded: saved,
    currentLabel: formatRegenSummaryText(summary),
    etaMs: null,
    summary,
    phase: "completed",
  });
}

export interface RecalculateMmGroupJobContext {
  beadLibraries: BeadLibraryEntry[];
  beadLibrarySizes: BeadLibrarySizeOffer[];
  beadSizes: BeadSizeEntry[];
  beadTypes: BeadTypeEntry[];
  recalculateMmGroupReferences: () => Promise<{ groups: number; updated: number; skipped: number }>;
  refreshBeadLibrarySizes: () => Promise<void>;
}

/** Safe recalculate + regen pipeline used by Bead sizes admin. */
export async function runRecalculateMmGroupJob(
  ctx: RecalculateMmGroupJobContext,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: NormalizedRegenJobProgress) => void;
    /** When true, re-export every eligible junction (not only stale). */
    force?: boolean;
  },
): Promise<{
  recalc: { groups: number; updated: number; skipped: number };
  regen: NormalizedRegenJobProgress;
}> {
  const report = (partial: Partial<NormalizedRegenJobProgress> & { status: NormalizedRegenJobStatus }) => {
    options?.onProgress?.(makeProgress(partial, partial.total ?? 0));
  };

  report({
    status: "preparing",
    phase: "preparing",
    currentLabel: "Loading crop data…",
  });

  report({
    status: "preparing",
    phase: "preparing",
    currentLabel: "Preparing assets…",
  });
  const recalc = await ctx.recalculateMmGroupReferences();

  const [freshOffers, freshSizes] = await Promise.all([
    beadLibrarySizesApi.list(),
    beadSizesApi.list(true),
  ]);
  await ctx.refreshBeadLibrarySizes();

  report({
    status: "preparing",
    phase: "preparing",
    currentLabel: "Loading crop data…",
  });
  const libraries = await hydrateCropConfigs(ctx.beadLibraries, freshOffers, {
    signal: options?.signal,
  });

  const items = buildNormalizedRegenQueue(
    libraries,
    freshOffers,
    freshSizes,
    ctx.beadTypes,
    { scope: "all", force: options?.force === true, includeIneligible: true },
  );

  report({
    status: "running",
    phase: "updating-sizes",
    done: 0,
    total: items.length,
    saved: 0,
    reference: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    succeeded: 0,
    currentLabel: "Updating bead sizes…",
    etaMs: null,
  });

  const regen = await runNormalizedAssetRegenJob({
    items,
    signal: options?.signal,
    onProgress: (p) => {
      const phase: RefreshBeadAssetsPhase =
        p.status === "completed"
          ? "completed"
          : p.done >= p.total && p.total > 0
            ? "finalizing"
            : "generating-images";
      options?.onProgress?.({ ...p, phase });
    },
    factorsRefreshed: recalc.updated,
    sizeGroupsProcessed: recalc.groups,
  });

  return { recalc, regen };
}

/**
 * Client-friendly batch refresh: recalculate size groups, regenerate exports, refresh cache.
 * Replaces separate "Recalculate size group references" + "Regenerate normalized exports" actions.
 */
export async function runRefreshBeadAssetsJob(
  ctx: RecalculateMmGroupJobContext,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: NormalizedRegenJobProgress) => void;
    force?: boolean;
  },
): Promise<{
  recalc: { groups: number; updated: number; skipped: number };
  regen: NormalizedRegenJobProgress;
}> {
  return runRecalculateMmGroupJob(ctx, options);
}

/** Regenerate only flagged/stale exports (no reference recalculation). */
export async function runPendingNormalizedRegenJob(
  ctx: RecalculateMmGroupJobContext,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: NormalizedRegenJobProgress) => void;
  },
): Promise<NormalizedRegenJobProgress> {
  const libraries = await hydrateCropConfigs(ctx.beadLibraries, ctx.beadLibrarySizes, {
    signal: options?.signal,
  });

  const items = buildNormalizedRegenQueue(
    libraries,
    ctx.beadLibrarySizes,
    ctx.beadSizes,
    ctx.beadTypes,
    { scope: "all", force: false },
  );

  return runNormalizedAssetRegenJob({
    items,
    signal: options?.signal,
    onProgress: options?.onProgress,
    factorsRefreshed: items.length,
  });
}

export { formatRegenSummaryText, type NormalizedRegenSummary };
