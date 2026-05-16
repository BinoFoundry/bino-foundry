import type { ReactNode } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdminToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  onBack?: () => void;
  title?: ReactNode;
  trailing?: ReactNode;
  hideSearch?: boolean;
}

export function AdminToolbar({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  onAdd,
  addLabel = "Add",
  onBack,
  title,
  trailing,
  hideSearch,
}: AdminToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
      {onBack ? (
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}
      {title ? <div className="min-w-0 flex-1">{title}</div> : null}
      {!hideSearch && onSearchChange ? (
        <div className="relative min-w-[12rem] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm transition-colors focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      ) : null}
      {trailing}
      {onAdd ? (
        <Button size="sm" onClick={onAdd} className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
