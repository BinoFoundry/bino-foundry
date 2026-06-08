import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";

export interface SelectedBeadRow {
  key: string;
  name: string;
  quantity: number;
  onRemove: () => void;
}

interface SelectedBeadsListProps {
  rows: SelectedBeadRow[];
  compact?: boolean;
}

export function SelectedBeadsList({ rows, compact = false }: SelectedBeadsListProps) {
  if (!rows.length) {
    return (
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "text-[11px] leading-relaxed" : "rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-xs leading-relaxed",
        )}
      >
        {BRACELET_COPY.summaryEmpty}
      </p>
    );
  }

  return (
    <ul className={cn(compact ? "space-y-1" : "space-y-1.5")}>
      {rows.map((row) => (
        <li
          key={row.key}
          className={cn(
            "flex items-center justify-between gap-2",
            compact
              ? "rounded-md border border-border/50 bg-background/50 px-2 py-1.5"
              : "rounded-lg border border-border/60 bg-background/60 px-3 py-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-medium text-foreground", compact ? "text-[11px]" : "text-xs")}>
              {row.name}
              {row.quantity > 1 ? (
                <span className="text-muted-foreground"> × {row.quantity}</span>
              ) : null}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 text-muted-foreground hover:text-destructive",
              compact ? "h-6 w-6" : "h-8 w-8",
            )}
            aria-label={`${BRACELET_COPY.removeBead} ${row.name}`}
            onClick={row.onRemove}
          >
            <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
