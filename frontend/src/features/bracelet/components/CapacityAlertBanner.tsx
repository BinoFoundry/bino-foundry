import { AlertCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { BRACELET_COPY } from "../copy";

export type CapacityAlertVariant = "blocked" | "full" | "over";

interface CapacityAlertBannerProps {
  variant: CapacityAlertVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<CapacityAlertVariant, string> = {
  blocked:
    "border-amber-500/35 bg-amber-500/12 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50",
  full: "border-amber-500/35 bg-amber-500/12 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50",
  over: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function CapacityAlertBanner({
  variant,
  message,
  onDismiss,
  className,
}: CapacityAlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-sm backdrop-blur-sm",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <p className="min-w-0 flex-1 text-xs leading-snug">{message}</p>
      {onDismiss && variant !== "over" ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
          aria-label={BRACELET_COPY.dismissCapacityAlert}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
