import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AdminListRowProps {
  children: ReactNode;
  /** Buttons/controls rendered outside the row click target (avoids nested buttons). */
  actions?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function AdminListRow({ children, actions, onClick, selected, className }: AdminListRowProps) {
  const rowClass = cn(
    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 transition-colors",
    selected && "state-selected-subtle ring-1 ring-selection/30",
    className,
  );

  const mainClass = cn(
    "flex min-w-0 flex-1 items-center gap-3 text-left",
    onClick && "rounded-md hover:bg-muted/80",
  );

  return (
    <div className={rowClass}>
      {onClick ? (
        <button type="button" onClick={onClick} className={mainClass}>
          {children}
        </button>
      ) : (
        <div className={mainClass}>{children}</div>
      )}
      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </div>
  );
}
