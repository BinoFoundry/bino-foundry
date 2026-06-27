import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import { normalizedExportDiameterMatchesTarget } from "@bino-foundry/shared/types";

/** Final status for every bead junction that enters the regeneration pipeline. */
export type NormalizedRegenFinalStatus =
  | "SAVED"
  | "UNCHANGED"
  | "REFERENCE"
  | "SKIPPED"
  | "FAILED";

export interface NormalizedRegenAssetRecord {
  libraryId: string;
  libraryName: string;
  sizeMm: number;
  offerId: string | null;
  status: NormalizedRegenFinalStatus;
  reason: string;
  pipelineStep: string;
  assetVisibleDiameterPx: number | null;
  groupReferenceDiameterPx: number | null;
  isGroupReference: boolean;
}

export interface NormalizedRegenSummary {
  sizeGroupsProcessed: number;
  beadsProcessed: number;
  factorsRefreshed: number;
  saved: number;
  reference: number;
  unchanged: number;
  skipped: number;
  failed: number;
  records: NormalizedRegenAssetRecord[];
}

export class NormalizedRegenConsistencyError extends Error {
  readonly missing: NormalizedRegenAssetRecord[];

  constructor(message: string, missing: NormalizedRegenAssetRecord[] = []) {
    super(message);
    this.name = "NormalizedRegenConsistencyError";
    this.missing = missing;
  }
}

export function isGroupReferenceBead(
  assetVisibleDiameterPx: number,
  groupReferenceDiameterPx: number,
): boolean {
  if (assetVisibleDiameterPx <= 0 || groupReferenceDiameterPx <= 0) return false;
  return normalizedExportDiameterMatchesTarget(assetVisibleDiameterPx, groupReferenceDiameterPx);
}

export function tallyRegenRecords(records: NormalizedRegenAssetRecord[]): Omit<
  NormalizedRegenSummary,
  "records" | "sizeGroupsProcessed" | "factorsRefreshed"
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

  return {
    beadsProcessed: records.length,
    saved,
    reference,
    unchanged,
    skipped,
    failed,
  };
}

/** Throws when processed count ≠ saved + reference + unchanged + skipped + failed. */
export function assertRegenSummaryConsistency(
  records: NormalizedRegenAssetRecord[],
  context?: { sizeGroupsProcessed?: number; factorsRefreshed?: number },
): NormalizedRegenSummary {
  const tally = tallyRegenRecords(records);
  const sum =
    tally.saved + tally.reference + tally.unchanged + tally.skipped + tally.failed;

  if (sum !== records.length) {
    const statusCounts = new Map<NormalizedRegenFinalStatus, number>();
    for (const r of records) {
      statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
    }
    console.error("[Normalized regen] Consistency failure", {
      records: records.length,
      sum,
      statusCounts: Object.fromEntries(statusCounts),
      recordsWithoutStatus: records.filter((r) => !r.status),
    });
    throw new NormalizedRegenConsistencyError(
      `Regeneration totals inconsistent: ${records.length} processed ≠ ${sum} accounted (saved=${tally.saved}, reference=${tally.reference}, unchanged=${tally.unchanged}, skipped=${tally.skipped}, failed=${tally.failed})`,
      records.filter((r) => !r.status),
    );
  }

  return {
    sizeGroupsProcessed: context?.sizeGroupsProcessed ?? 0,
    factorsRefreshed: context?.factorsRefreshed ?? 0,
    records,
    ...tally,
  };
}

export function formatRegenSummaryText(summary: NormalizedRegenSummary): string {
  return [
    `Size groups processed: ${summary.sizeGroupsProcessed}`,
    `Beads processed: ${summary.beadsProcessed}`,
    `Factors refreshed: ${summary.factorsRefreshed}`,
    `Saved: ${summary.saved}`,
    `Reference: ${summary.reference}`,
    `Unchanged: ${summary.unchanged}`,
    `Skipped: ${summary.skipped}`,
    `Failed: ${summary.failed}`,
  ].join("\n");
}

export function regenRecordForSkipped(input: {
  libraryId: string;
  libraryName: string;
  sizeMm: number;
  offerId: string | null;
  reason: string;
  pipelineStep: string;
}): NormalizedRegenAssetRecord {
  return {
    libraryId: input.libraryId,
    libraryName: input.libraryName,
    sizeMm: input.sizeMm,
    offerId: input.offerId,
    status: "SKIPPED",
    reason: input.reason,
    pipelineStep: input.pipelineStep,
    assetVisibleDiameterPx: null,
    groupReferenceDiameterPx: null,
    isGroupReference: false,
  };
}

export function regenRecordFromExport(input: {
  libraryId: string;
  libraryName: string;
  sizeMm: number;
  offerId: string | null;
  status: NormalizedRegenFinalStatus;
  reason: string;
  pipelineStep: string;
  assetVisibleDiameterPx: number;
  groupReferenceDiameterPx: number;
  isGroupReference: boolean;
}): NormalizedRegenAssetRecord {
  return {
    libraryId: input.libraryId,
    libraryName: input.libraryName,
    sizeMm: input.sizeMm,
    offerId: input.offerId,
    status: input.status,
    reason: input.reason,
    pipelineStep: input.pipelineStep,
    assetVisibleDiameterPx: input.assetVisibleDiameterPx,
    groupReferenceDiameterPx: input.groupReferenceDiameterPx,
    isGroupReference: input.isGroupReference,
  };
}
