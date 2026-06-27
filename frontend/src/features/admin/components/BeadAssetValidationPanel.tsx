import { cn } from "@/lib/utils";
import type { BeadCropConfig } from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import {
  validateBeadAsset,
  type BeadAssetValidationStatus,
} from "@/features/admin/lib/bead-asset-validation";

interface BeadAssetValidationPanelProps {
  bead: Pick<BeadLibraryEntry, "cropConfig" | "processedImage" | "image" | "originalImage">;
  draftConfig?: BeadCropConfig | null;
  className?: string;
}

const STATUS_STYLES: Record<BeadAssetValidationStatus, string> = {
  excellent: "bg-status-success/15 text-status-success border-status-success/30",
  good: "bg-primary/10 text-primary border-primary/25",
  "needs-adjustment": "bg-status-warning/15 text-status-warning border-status-warning/30",
};

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCentered(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

export function BeadAssetValidationPanel({
  bead,
  draftConfig,
  className,
}: BeadAssetValidationPanelProps) {
  const result = validateBeadAsset(bead, draftConfig);

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-muted/15 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Asset standard check</p>
          <p className="text-xs text-muted-foreground">
            Prepare assets externally so beads at the same mm size look consistent on the strand.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLES[result.status],
          )}
        >
          {result.statusLabel}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Visible footprint</dt>
          <dd className="font-medium tabular-nums">{formatPct(result.visibleFootprintPct)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Canvas usage</dt>
          <dd className="font-medium tabular-nums">{formatPct(result.canvasUsagePct)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Image centered</dt>
          <dd className="font-medium">{formatCentered(result.imageCentered)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Aspect ratio</dt>
          <dd className="font-medium tabular-nums">
            {result.aspectRatio != null ? result.aspectRatio.toFixed(2) : "—"}
            {result.aspectRatioLabel ? (
              <span className="ml-1 text-muted-foreground">({result.aspectRatioLabel})</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {result.issues.length > 0 ? (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          {result.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Asset meets the standard. Same-mm beads should appear consistent in the builder.
        </p>
      )}
    </div>
  );
}
