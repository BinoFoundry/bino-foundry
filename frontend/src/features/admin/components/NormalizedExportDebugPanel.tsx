import { useCallback, useEffect, useState } from "react";
import { Download, Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  diagnoseNormalizedExport,
  normalizedExportCanvasSidePx,
  type NormalizedExportRenderDiagnosis,
} from "@/render/bead-crop";
import type { BeadCropConfig } from "@bino-foundry/shared/types";
import type { BeadSizeEntry } from "@/types/bead-sizes";

interface NormalizedExportDebugPanelProps {
  cropConfig: BeadCropConfig;
  enabledSizeMms: number[];
  beadSizes: BeadSizeEntry[];
  beadName: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bead";
}

export function NormalizedExportDebugPanel({
  cropConfig,
  enabledSizeMms,
  beadSizes,
  beadName,
}: NormalizedExportDebugPanelProps) {
  const [sizeMm, setSizeMm] = useState<number>(() => enabledSizeMms[0] ?? 6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<NormalizedExportRenderDiagnosis | null>(null);

  useEffect(() => {
    return () => {
      const cmp = report?.comparison;
      if (cmp?.processed.objectUrl) URL.revokeObjectURL(cmp.processed.objectUrl);
      if (cmp?.normalized.objectUrl) URL.revokeObjectURL(cmp.normalized.objectUrl);
    };
  }, [report?.comparison]);

  const groupReference = beadSizes.find((s) => s.sizeMm === sizeMm)?.groupReferenceDiameterPx ?? null;

  const runComparison = useCallback(async () => {
    if (!groupReference || groupReference <= 0) {
      setError(`No size group reference for ${sizeMm} mm — run Recalculate size group references first.`);
      return;
    }

    setBusy(true);
    setError(null);
    if (report?.comparison) {
      URL.revokeObjectURL(report.comparison.processed.objectUrl);
      URL.revokeObjectURL(report.comparison.normalized.objectUrl);
    }
    setReport(null);

    try {
      const next = await diagnoseNormalizedExport(cropConfig, {
        configuredSizeMm: sizeMm,
        groupReferenceDiameterPx: groupReference,
      });
      setReport(next);

      if (!next.comparison.bitmapsVisuallyDistinct && next.normalizationScale > 1.02) {
        setError(
          "Processed and normalized bitmaps look identical — pixels may not have changed. Re-save processed asset.",
        );
      } else if (!next.scaleApplied) {
        setError(
          `Normalized footprint outside tolerance: ${next.measuredVisibleDiameterPx.toFixed(1)}px vs target ${next.targetVisibleDiameterPx.toFixed(1)}px`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setBusy(false);
    }
  }, [cropConfig, groupReference, report?.comparison, sizeMm]);

  if (!enabledSizeMms.length) return null;

  const slug = slugify(beadName);
  const cmp = report?.comparison;

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">Bitmap visual acceptance</p>
          <p className="text-xs text-muted-foreground">
            Saves processed (before) and normalized (after) PNGs. Open them outside the app at 100%
            zoom — visible bead diameter must match across same-mm exports before using the builder.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Size (mm)</label>
          <select
            value={sizeMm}
            disabled={busy}
            onChange={(e) => setSizeMm(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {enabledSizeMms.map((mm) => (
              <option key={mm} value={mm}>
                {mm} mm
                {beadSizes.find((s) => s.sizeMm === mm)?.groupReferenceDiameterPx
                  ? ` · ref ${Math.round(
                      beadSizes.find((s) => s.sizeMm === mm)!.groupReferenceDiameterPx!,
                    )} px`
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" disabled={busy} onClick={() => void runComparison()}>
          {busy ? "Rendering…" : "Export both bitmaps"}
        </Button>
      </div>

      {groupReference ? (
        <p className="text-xs text-muted-foreground">
          Group canvas side for {sizeMm} mm: {normalizedExportCanvasSidePx(groupReference)}×
          {normalizedExportCanvasSidePx(groupReference)} px (all same-mm normalized exports)
        </p>
      ) : (
        <p className="text-xs text-status-warning">
          Missing group reference — recalculate size group references first.
        </p>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {cmp ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="space-y-2 rounded-lg border border-border bg-background p-3">
              <figcaption className="text-xs font-medium">Processed (before normalization)</figcaption>
              <img
                src={cmp.processed.objectUrl}
                alt="Processed export"
                className="mx-auto max-h-48 w-full object-contain"
              />
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {cmp.processed.canvasWidthPx}×{cmp.processed.canvasHeightPx} px · visible{" "}
                {cmp.processed.visibleDiameterPx.toFixed(0)} px
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() =>
                  downloadBlob(cmp.processed.blob, `${slug}-${sizeMm}mm-processed.png`)
                }
              >
                <Download className="mr-1.5 h-3 w-3" />
                Download processed PNG
              </Button>
            </figure>

            <figure className="space-y-2 rounded-lg border border-border bg-background p-3">
              <figcaption className="text-xs font-medium">Normalized (after normalization)</figcaption>
              <img
                src={cmp.normalized.objectUrl}
                alt="Normalized export"
                className="mx-auto max-h-48 w-full object-contain"
              />
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {cmp.normalized.canvasWidthPx}×{cmp.normalized.canvasHeightPx} px · visible{" "}
                {cmp.normalized.visibleDiameterPx.toFixed(0)} px
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() =>
                  downloadBlob(cmp.normalized.blob, `${slug}-${sizeMm}mm-normalized.png`)
                }
              >
                <Download className="mr-1.5 h-3 w-3" />
                Download normalized PNG
              </Button>
            </figure>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Visible ratio</dt>
              <dd className="font-medium tabular-nums">{cmp.visibleDiameterRatio.toFixed(2)}×</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pixels changed</dt>
              <dd
                className={
                  cmp.bitmapsVisuallyDistinct
                    ? "font-medium text-status-success"
                    : "font-medium text-destructive"
                }
              >
                {cmp.bitmapsVisuallyDistinct ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Group canvas</dt>
              <dd className="font-medium tabular-nums">{cmp.groupCanvasSidePx} px</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">At target</dt>
              <dd
                className={
                  cmp.scaleApplied ? "font-medium text-status-success" : "font-medium text-destructive"
                }
              >
                {cmp.scaleApplied ? "Yes" : "No"}
              </dd>
            </div>
          </dl>

          {cmp.bitmapsVisuallyDistinct ? (
            <p className="text-xs text-muted-foreground">
              Open both PNGs at 100% zoom side by side. The normalized file should show a larger
              (or smaller) bead. Repeat for two other same-mm beads — all three normalized files
              should match visually before checking the builder.
            </p>
          ) : (
            <p className="text-xs text-destructive">
              Processed and normalized look the same — normalization did not change the bitmap.
              This bead may already be the group reference (scale ≈ 1), or export failed silently.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
