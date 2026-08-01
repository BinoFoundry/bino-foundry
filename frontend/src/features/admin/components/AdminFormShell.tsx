import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ADMIN_UNSAVED_COPY } from "../unsaved-changes";

interface AdminFormShellProps {
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
  /** When true, shows a subtle unsaved-changes status near the actions. */
  isDirty?: boolean;
  saving?: boolean;
}

export function AdminFormShell({
  children,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  className,
  isDirty = false,
  saving = false,
}: AdminFormShellProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("portal-card space-y-4 p-4 sm:p-6", className)}
    >
      {children}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
        {isDirty ? (
          <p className="mr-auto text-xs text-muted-foreground" role="status" aria-live="polite">
            {ADMIN_UNSAVED_COPY.status}
          </p>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
