import { cn } from "@/lib/utils";

import { labelForAutoSaveStatus } from "./builder-save-copy";
import type { DesignAutoSaveStatus } from "./design-autosave-controller";

interface BuilderSaveStatusProps {
  status: DesignAutoSaveStatus;
  visible?: boolean;
  signedIn?: boolean;
  className?: string;
}

export function BuilderSaveStatus({
  status,
  visible = true,
  signedIn = true,
  className,
}: BuilderSaveStatusProps) {
  if (!visible) return null;

  // Unauthenticated users are handled by the visible "Save design" button, which
  // opens the login flow on click — no permanent inline prompt in the layout.
  if (!signedIn) return null;

  const label = labelForAutoSaveStatus(status);
  if (!label) return null;

  return (
    <p
      className={cn(
        "text-center text-[10px] leading-snug text-muted-foreground sm:text-xs",
        status === "error" && "text-destructive",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  );
}
