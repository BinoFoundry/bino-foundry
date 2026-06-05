import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { variantsForLibrary } from "@/features/bracelet/variants";
import { beadVariantsApi } from "@/services/api/bead-variants";
import { useCatalogue } from "@/state/catalogue";
import type { BeadVariantEntry } from "@/types/bead-variants";

interface BeadVariantsPanelProps {
  beadLibraryId: string;
}

/** Manage per-size prices for one bead (shared crop asset). */
export function BeadVariantsPanel({ beadLibraryId }: BeadVariantsPanelProps) {
  const cat = useCatalogue();
  const variants = useMemo(
    () => variantsForLibrary(cat.beadVariants, beadLibraryId),
    [cat.beadVariants, beadLibraryId],
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const savePrice = async (v: BeadVariantEntry, price: number) => {
    setSavingId(v.id);
    try {
      await beadVariantsApi.update(v.id, { unitPrice: price });
      await cat.refreshFromApi();
    } finally {
      setSavingId(null);
    }
  };

  if (!variants.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No size variants yet. Run migration 000016 or add variants via API after saving this bead.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-foreground">Size variants (price per mm)</p>
      <p className="text-[10px] text-muted-foreground">
        One cropped image — each row is a sellable size. Disable unused sizes in the database or set price to 0.
      </p>
      <ul className="space-y-2">
        {variants.map((v) => (
          <li key={v.publicId} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-16 font-medium tabular-nums">{v.sizeMm} mm</span>
            <input
              type="number"
              min={0}
              step={0.01}
              defaultValue={v.unitPrice}
              className="w-24 rounded border border-border px-2 py-1"
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (!Number.isNaN(next) && next !== v.unitPrice) void savePrice(v, next);
              }}
            />
            <span className="text-muted-foreground">{v.label}</span>
            {savingId === v.id ? <span className="text-[10px] text-muted-foreground">Saving…</span> : null}
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => void cat.refreshFromApi()}>
        Refresh variants
      </Button>
    </div>
  );
}
