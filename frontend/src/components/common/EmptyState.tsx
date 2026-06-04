import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center",
        className,
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground/70" aria-hidden />
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
