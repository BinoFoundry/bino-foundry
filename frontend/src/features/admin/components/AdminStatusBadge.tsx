import { cn } from "@/lib/utils";

const VARIANTS = {
  success: "bg-status-success border border-status-success",
  warning: "bg-status-warning border border-status-warning",
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
        "type-label shrink-0 rounded px-1.5 py-0.5",
        VARIANTS[variant],
      )}
    >
      {label}
    </span>
  );
}
