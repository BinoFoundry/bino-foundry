import { Copy, Gem, Glasses, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { formatCurrency } from "@bino-foundry/shared/currency";

import { Button } from "@/components/ui/button";
import { formatDesignDisplayTitle } from "@/features/designs/display-title";
import type { SavedDesignSummary } from "@bino-foundry/shared/types";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

interface DesignCardProps {
  design: SavedDesignSummary;
  onDuplicate: () => void;
  onDelete: () => void;
  onCheckout: () => void;
  duplicating?: boolean;
}

export function DesignCard({ design, onDuplicate, onDelete, onCheckout, duplicating }: DesignCardProps) {
  const module = design.productType === "bracelet" ? "bracelet" : "sunglasses";
  const Icon = design.productType === "bracelet" ? Gem : Glasses;
  const editable = design.status !== "ordered";

  return (
    <article className="portal-card overflow-hidden">
      <div className="flex gap-4 p-4 sm:p-5">
        {design.previewThumbnailUrl ? (
          <img
            src={design.previewThumbnailUrl}
            alt=""
            className="h-24 w-24 shrink-0 rounded-xl border border-border/50 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted/40">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="truncate font-medium text-foreground">{formatDesignDisplayTitle(design)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {design.productType === "bracelet" ? "Bracelet" : "Sunglasses"} · Updated{" "}
                {formatDate(design.updatedAt)}
              </p>
            </div>
            <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium capitalize text-foreground/80">
              {design.status}
            </span>
          </div>

          <p className="type-price mt-3 text-lg text-foreground">
            {formatCurrency(design.subtotal, design.currencyCode)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/50 bg-background/40 px-4 py-3 sm:px-5">
        {editable ? (
          <Button type="button" size="sm" asChild>
            <Link to={`/${module}?design=${encodeURIComponent(design.id)}`}>Continue editing</Link>
          </Button>
        ) : null}
        {editable ? (
          <Button type="button" size="sm" variant="secondary" onClick={onCheckout}>
            <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
            Checkout
          </Button>
        ) : null}
        {editable ? (
          <Button type="button" size="sm" variant="ghost" disabled={duplicating} onClick={onDuplicate}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {duplicating ? "Duplicating…" : "Duplicate"}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onDelete} aria-label="Delete design">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}
