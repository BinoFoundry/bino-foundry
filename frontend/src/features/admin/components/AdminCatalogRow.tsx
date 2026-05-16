import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdminCatalogRowProps {
  title: string;
  subtitle: string;
  active?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function AdminCatalogRow({
  title,
  subtitle,
  active = true,
  onEdit,
  onDelete,
}: AdminCatalogRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {!active && <p className="text-[10px] text-amber-600">Inactive</p>}
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
