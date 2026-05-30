import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
} as const;

export function AdminStatusBadge({
  label,
  variant = "muted",
}: {
  label: string;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        VARIANTS[variant],
      )}
    >
      {label}
    </span>
  );
}
