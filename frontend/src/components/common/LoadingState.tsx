import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="motion-safe-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}
