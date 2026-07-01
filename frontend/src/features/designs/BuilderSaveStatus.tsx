import { Check, CloudOff, Loader2 } from "lucide-react";

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
          "text-[10px] leading-snug text-muted-foreground sm:text-xs",
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

  const Icon =
    status === "saving" ? Loader2 : status === "offline" ? CloudOff : status === "saved" ? Check : null;

  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-[10px] leading-snug text-muted-foreground sm:text-xs",
        status === "saved" && "text-status-success",
        status === "error" && "text-destructive",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {Icon ? (
        <Icon
          className={cn("h-3 w-3 shrink-0", status === "saving" && "animate-spin")}
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
    </p>
  );
}
