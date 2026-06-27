import { describe, expect, it } from "vitest";

import {
  assertRegenSummaryConsistency,
  formatRegenSummaryText,
  regenRecordForSkipped,
  regenRecordFromExport,
  tallyRegenRecords,
} from "./normalized-regen-pipeline";

describe("normalized-regen-pipeline", () => {
  it("formats summary text with all counters", () => {
    const records = [
      regenRecordFromExport({
        libraryId: "a",
        libraryName: "Gold Sheen Obsidian",
        sizeMm: 6,
        offerId: "1",
        status: "REFERENCE",
        reason: "Largest visible bead",
        pipelineStep: "assign-reference",
        assetVisibleDiameterPx: 400,
        groupReferenceDiameterPx: 400,
        isGroupReference: true,
      }),
      regenRecordFromExport({
        libraryId: "b",
        libraryName: "Aquamarine",
        sizeMm: 6,
        offerId: "2",
        status: "SAVED",
        reason: "Bitmap regenerated",
        pipelineStep: "save-asset",
        assetVisibleDiameterPx: 350,
        groupReferenceDiameterPx: 400,
        isGroupReference: false,
      }),
    ];

    const summary = assertRegenSummaryConsistency(records, {
      sizeGroupsProcessed: 1,
      factorsRefreshed: 2,
    });

    expect(formatRegenSummaryText(summary)).toContain("Beads processed: 2");
    expect(formatRegenSummaryText(summary)).toContain("Reference: 1");
    expect(formatRegenSummaryText(summary)).toContain("Saved: 1");
  });

  it("accounts for skipped junctions in totals", () => {
    const records = [
      regenRecordForSkipped({
        libraryId: "x",
        libraryName: "Broken",
        sizeMm: 8,
        offerId: "x-8",
        reason: "Invalid or missing crop configuration",
        pipelineStep: "validate-crop",
      }),
    ];

    const summary = assertRegenSummaryConsistency(records);
    expect(summary.skipped).toBe(1);
    expect(tallyRegenRecords(records).beadsProcessed).toBe(1);
  });
});
