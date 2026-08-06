import type { BeadSizeDraftRow } from "@/types/bead-library-sizes";
import { formatBeadSizeMm } from "@/lib/bead-size-format";

interface BeadLibrarySizesPanelProps {
  rows: BeadSizeDraftRow[];
  onRowsChange: (rows: BeadSizeDraftRow[]) => void;
}

export function BeadLibrarySizesPanel({ rows, onRowsChange }: BeadLibrarySizesPanelProps) {
  const toggle = (sizeMm: number, enabled: boolean) => {
    onRowsChange(
      rows.map((r) => (r.sizeMm === sizeMm ? { ...r, enabled } : r)),
    );
  };

  const setPrice = (sizeMm: number, unitPrice: number) => {
    onRowsChange(
      rows.map((r) => (r.sizeMm === sizeMm ? { ...r, unitPrice } : r)),
    );
  };

  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No global bead sizes defined. Add sizes under Products → Bead Sizes first.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-xs font-medium text-foreground">Available sizes</p>
        <p className="text-[10px] text-muted-foreground">
          Select sizes to offer and set the price for each. Pricing is defined only at the size level.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.sizeMm} className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex min-w-[5.5rem] items-center gap-1.5">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => toggle(r.sizeMm, e.target.checked)}
              />
              <span className="font-medium tabular-nums">{formatBeadSizeMm(r.sizeMm)}</span>
            </label>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                disabled={!r.enabled}
                value={r.enabled ? r.unitPrice : ""}
                placeholder="—"
                className="w-24 rounded border border-border px-2 py-1 disabled:opacity-40"
                onChange={(e) => setPrice(r.sizeMm, Number(e.target.value) || 0)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
