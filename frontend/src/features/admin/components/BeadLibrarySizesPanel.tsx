import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { beadLibrarySizesApi } from "@/services/api/bead-library-sizes";
import { useCatalogue } from "@/state/catalogue";
import type { BeadSizeEntry } from "@/types/bead-sizes";

interface BeadLibrarySizesPanelProps {
  beadLibraryId: string;
  basePrice: number;
  beadTypeSlug?: string;
}

type DraftRow = {
  sizeMm: number;
  label: string;
  enabled: boolean;
  unitPrice: number;
};

export function BeadLibrarySizesPanel({
  beadLibraryId,
  basePrice,
}: BeadLibrarySizesPanelProps) {
  const cat = useCatalogue();
  const globalSizes = useMemo(
    () =>
      [...cat.beadSizes]
        .filter((s) => s.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeMm - b.sizeMm),
    [cat.beadSizes],
  );

  const existing = useMemo(
    () => sizesForLibrary(cat.beadLibrarySizes, beadLibraryId),
    [cat.beadLibrarySizes, beadLibraryId],
  );

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  const buildRows = useCallback(
    (sizes: BeadSizeEntry[]) => {
      return sizes.map((gs) => {
        const offer = existing.find((o) => o.sizeMm === gs.sizeMm);
        return {
          sizeMm: gs.sizeMm,
          label: gs.label,
          enabled: Boolean(offer),
          unitPrice: offer?.unitPrice ?? basePrice * gs.priceMultiplier,
        };
      });
    },
    [basePrice, existing],
  );

  useEffect(() => {
    setRows(buildRows(globalSizes));
  }, [globalSizes, buildRows]);

  const toggle = (sizeMm: number, enabled: boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.sizeMm !== sizeMm) return r;
        return { ...r, enabled };
      }),
    );
  };

  const setPrice = (sizeMm: number, unitPrice: number) => {
    setRows((prev) => prev.map((r) => (r.sizeMm === sizeMm ? { ...r, unitPrice } : r)));
  };

  const applySuggested = async () => {
    const enabledMm = rows.filter((r) => r.enabled).map((r) => r.sizeMm);
    if (!enabledMm.length) return;
    try {
      const suggested = await beadLibrarySizesApi.suggestPrices(beadLibraryId, enabledMm);
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          unitPrice: suggested[String(r.sizeMm)] ?? suggested[r.sizeMm] ?? r.unitPrice,
        })),
      );
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    const enabled = rows.filter((r) => r.enabled);
    if (!enabled.length) {
      alert("Select at least one available size.");
      return;
    }
    setSaving(true);
    try {
      await beadLibrarySizesApi.sync(
        beadLibraryId,
        enabled.map((r, i) => ({
          sizeMm: r.sizeMm,
          unitPrice: r.unitPrice,
          isDefault: i === 0,
        })),
      );
      await cat.refreshFromApi();
    } finally {
      setSaving(false);
    }
  };

  if (!globalSizes.length) {
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
          One cropped image — check sizes to offer for this bead and set price per size.
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
              <span className="font-medium tabular-nums">{r.label}</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              disabled={!r.enabled}
              value={r.unitPrice}
              className="w-24 rounded border border-border px-2 py-1 disabled:opacity-40"
              onChange={(e) => setPrice(r.sizeMm, Number(e.target.value))}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => void applySuggested()}>
          Apply type pricing
        </Button>
        <Button type="button" size="sm" className="text-xs" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save sizes"}
        </Button>
      </div>
    </div>
  );
}
