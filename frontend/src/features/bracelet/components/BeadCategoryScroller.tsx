import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BeadTypeEntry } from "@/types/beads";

interface BeadCategoryScrollerProps {
  types: BeadTypeEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

const SCROLL_EDGE_THRESHOLD_PX = 2;

function ChevronControl({
  side,
  onClick,
  className,
}: {
  side: "left" | "right";
  onClick: () => void;
  className?: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Scroll categories left" : "Scroll categories right"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-6 w-5 -translate-y-1/2 items-center justify-center",
        "text-muted-foreground transition-colors",
        "hover:bg-selection-muted hover:text-foreground",
        side === "left" ? "left-0 rounded-r-sm" : "right-0 rounded-l-sm",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
    </button>
  );
}

/** Horizontal bead-type tabs with dynamic scroll chevrons. */
export function BeadCategoryScroller({
  types,
  activeId,
  onSelect,
  compact = false,
}: BeadCategoryScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= SCROLL_EDGE_THRESHOLD_PX) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > SCROLL_EDGE_THRESHOLD_PX);
    setCanScrollRight(el.scrollLeft < maxScroll - SCROLL_EDGE_THRESHOLD_PX);
  }, []);

  useLayoutEffect(() => {
    updateScrollHints();
  }, [types, updateScrollHints]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollHints();
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);

    const observer = new ResizeObserver(updateScrollHints);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
      observer.disconnect();
    };
  }, [updateScrollHints]);

  const scrollByDirection = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.72 * direction, behavior: "smooth" });
  };

  return (
    <div className="relative shrink-0 border-b border-border/60">
      {canScrollLeft ? <ChevronControl side="left" onClick={() => scrollByDirection(-1)} /> : null}
      {canScrollRight ? <ChevronControl side="right" onClick={() => scrollByDirection(1)} /> : null}

      <div
        ref={scrollerRef}
        className={cn(
          "flex gap-1 overflow-x-auto scroll-smooth",
          compact ? "px-2 py-1.5" : "px-2 py-2",
          canScrollLeft && "pl-5",
          canScrollRight && "pr-5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
              activeId === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-selection-muted hover:text-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
