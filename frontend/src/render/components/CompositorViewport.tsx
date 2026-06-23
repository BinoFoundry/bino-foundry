import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CompositorAspectRatio = "16/10" | "16/9" | "video" | "square";

const aspectClass: Record<CompositorAspectRatio, string> = {
  "16/10": "aspect-[16/10]",
  "16/9": "aspect-video",
  video: "aspect-video",
  square: "aspect-square",
};

interface CompositorViewportProps {
  children: ReactNode;
  aspectRatio?: CompositorAspectRatio;
  label?: string;
  className?: string;
  /** `fill` — expand to parent height (dual preview stack). `aspect` — fixed ratio (default). */
  variant?: "aspect" | "fill";
  compactLabel?: boolean;
}

/**
 * Responsive preview shell (prototype `.preview-box`).
 */
export function CompositorViewport({
  children,
  aspectRatio = "16/10",
  label,
  className,
  variant = "aspect",
  compactLabel = false,
}: CompositorViewportProps) {
  return (
    <div
      className={cn(
        "compositor-surface relative w-full overflow-hidden",
        variant === "fill" ? "h-full min-h-0" : aspectClass[aspectRatio],
        className,
      )}
    >
      {label && (
        <div
          className={cn(
            "absolute z-[60]",
            compactLabel ? "left-3 top-2.5" : "left-6 top-4 sm:left-8 sm:top-6",
          )}
        >
          <span
            className={cn(
              "type-label rounded-full border border-border/70 bg-card/85 text-muted-foreground backdrop-blur",
              compactLabel ? "px-2.5 py-0.5 text-[10px] tracking-wide" : "px-3 py-1.5",
            )}
          >
            {label}
          </span>
        </div>
      )}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
