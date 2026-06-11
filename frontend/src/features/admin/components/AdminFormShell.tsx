import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminFormShellProps {
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
}

export function AdminFormShell({
  children,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  className,
}: AdminFormShellProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "portal-card space-y-4 p-4 sm:p-6",
        className,
      )}
    >
      {children}
      <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
