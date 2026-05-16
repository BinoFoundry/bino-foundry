import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AdminListRowProps {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function AdminListRow({ children, onClick, selected, className }: AdminListRowProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/80",
          selected && "bg-primary/15 ring-2 ring-primary",
          className,
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5",
        selected && "bg-primary/15 ring-2 ring-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}
