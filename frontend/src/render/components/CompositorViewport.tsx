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
}

/**
 * Responsive preview shell (prototype `.preview-box`).
 */
export function CompositorViewport({
  children,
  aspectRatio = "16/10",
  label,
  className,
}: CompositorViewportProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[2rem] border border-white bg-[radial-gradient(circle_at_center,#ffffff_0%,#f1f5f9_100%)] shadow-xl",
        aspectClass[aspectRatio],
        className,
      )}
    >
      {label && (
        <div className="absolute left-6 top-4 z-[60] sm:left-8 sm:top-6">
          <span className="rounded-full border border-border bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur">
            {label}
          </span>
        </div>
      )}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
