import { cn } from "@/lib/utils";

import { labelForAutoSaveStatus, BUILDER_SAVE_COPY } from "./builder-save-copy";
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

  if (!signedIn) {
    return (
      <p
        className={cn(
          "text-center text-[10px] leading-snug text-muted-foreground sm:text-xs",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        {BUILDER_SAVE_COPY.signInToSave}
      </p>
    );
  }

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
