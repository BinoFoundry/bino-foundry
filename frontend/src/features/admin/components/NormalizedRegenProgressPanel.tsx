import type { NormalizedRegenJobProgress } from "@/features/admin/lib/normalized-asset-regen";
import { formatEtaMs } from "@/features/admin/lib/normalized-asset-regen";
import { useAdminDeveloperMode } from "@/features/admin/lib/developer-mode";

import { NormalizedRegenReportPanel } from "./NormalizedRegenReportPanel";

function friendlyPhaseLabel(progress: NormalizedRegenJobProgress): string {
  if (progress.status === "failed") return "Something went wrong";
  if (progress.status === "cancelled") return "Cancelled";

  switch (progress.phase) {
    case "preparing":
      return "Preparing assets…";
    case "updating-sizes":
      return "Updating bead sizes…";
    case "generating-images":
      return "Generating optimized images…";
    case "finalizing":
      return "Finalizing…";
    case "completed":
      return "Completed successfully.";
    default:
      if (progress.status === "preparing") return "Preparing assets…";
      if (progress.status === "completed") return "Completed successfully.";
      if (progress.status === "running") return "Generating optimized images…";
      return "Processing…";
  }
}

function clientCounts(progress: NormalizedRegenJobProgress) {
  const processed = progress.status === "completed" ? progress.total : progress.done;
  const updated = progress.saved + progress.reference + progress.unchanged;
  return { processed, updated, skipped: progress.skipped, failed: progress.failed };
}

export function NormalizedRegenProgressPanel({
  progress,
}: {
  progress: NormalizedRegenJobProgress;
}) {
  const developerMode = useAdminDeveloperMode();

  if (progress.status === "idle") return null;

  const progressPct =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  const phaseLabel = friendlyPhaseLabel(progress);
  const counts = clientCounts(progress);
  const showCounts =
    progress.status === "running" ||
    progress.status === "completed" ||
    counts.processed > 0 ||
    counts.failed > 0;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{phaseLabel}</p>
          {progress.status === "running" ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              {progress.done} / {progress.total}
            </p>
          ) : null}
        </div>

        {progress.status === "running" || progress.status === "preparing" ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : null}

        {progress.status === "running" && developerMode ? (
          <p className="text-xs text-muted-foreground">
            Estimated remaining time: {formatEtaMs(progress.etaMs)}
          </p>
        ) : null}

        {showCounts ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Processed</dt>
              <dd className="font-medium tabular-nums">{counts.processed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-medium tabular-nums">{counts.updated}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Skipped</dt>
              <dd className="font-medium tabular-nums">{counts.skipped}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Failed</dt>
              <dd className="font-medium tabular-nums">{counts.failed}</dd>
            </div>
          </dl>
        ) : null}

        {developerMode && progress.currentLabel ? (
          <p className="truncate text-xs text-muted-foreground">{progress.currentLabel}</p>
        ) : null}

        {progress.errorMessage ? (
          <p className="text-xs text-destructive">{progress.errorMessage}</p>
        ) : null}
      </section>

      {developerMode && progress.summary && progress.status === "completed" ? (
        <NormalizedRegenReportPanel summary={progress.summary} />
      ) : null}
    </div>
  );
}
