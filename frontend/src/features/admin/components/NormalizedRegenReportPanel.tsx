import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type {
  NormalizedRegenAssetRecord,
  NormalizedRegenFinalStatus,
  NormalizedRegenSummary,
} from "@/features/admin/lib/normalized-regen-pipeline";
import { formatRegenSummaryText } from "@/features/admin/lib/normalized-regen-pipeline";

function statusClass(status: NormalizedRegenFinalStatus): string {
  switch (status) {
    case "SAVED":
      return "text-emerald-600 dark:text-emerald-400";
    case "REFERENCE":
      return "text-sky-600 dark:text-sky-400";
    case "UNCHANGED":
      return "text-muted-foreground";
    case "SKIPPED":
      return "text-amber-600 dark:text-amber-400";
    case "FAILED":
      return "text-destructive";
  }
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export function NormalizedRegenReportPanel({ summary }: { summary: NormalizedRegenSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Regeneration summary</p>
      <div className="space-y-1">
        <SummaryLine label="Size groups processed" value={summary.sizeGroupsProcessed} />
        <SummaryLine label="Beads processed" value={summary.beadsProcessed} />
        <SummaryLine label="Factors refreshed" value={summary.factorsRefreshed} />
        <SummaryLine label="Saved" value={summary.saved} />
        <SummaryLine label="Reference" value={summary.reference} />
        <SummaryLine label="Unchanged" value={summary.unchanged} />
        <SummaryLine label="Skipped" value={summary.skipped} />
        <SummaryLine label="Failed" value={summary.failed} />
      </div>

      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {open ? "Hide" : "Show"} detailed report ({summary.records.length})
      </button>

      {open ? (
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr>
                <th className="px-2 py-1.5 font-medium">Bead</th>
                <th className="px-2 py-1.5 font-medium">Size</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {summary.records.map((row) => (
                <RegenReportRow key={`${row.libraryId}-${row.sizeMm}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <pre className="sr-only">{formatRegenSummaryText(summary)}</pre>
    </section>
  );
}

function RegenReportRow({ row }: { row: NormalizedRegenAssetRecord }) {
  return (
    <tr className="border-t border-border/60">
      <td className="px-2 py-1.5">{row.libraryName}</td>
      <td className="px-2 py-1.5 tabular-nums">{row.sizeMm} mm</td>
      <td className={`px-2 py-1.5 font-medium ${statusClass(row.status)}`}>{row.status}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{row.reason}</td>
    </tr>
  );
}
