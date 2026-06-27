import { useEffect, type RefObject } from "react";

const EDGE_THRESHOLD_PX = 2;

/**
 * Routes vertical wheel / trackpad gestures to a library sidebar scroll container
 * from anywhere inside the panel (search, categories, padding, bead cards).
 * Horizontal-dominant gestures are left to nested horizontal scrollers (category tabs).
 */
export function useLibraryPanelWheelScroll(
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      if (!scrollEl.contains(e.target as Node)) return;

      const { deltaX, deltaY } = e;
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= EDGE_THRESHOLD_PX) return;

      const atTop = scrollTop <= EDGE_THRESHOLD_PX;
      const atBottom = scrollTop >= maxScroll - EDGE_THRESHOLD_PX;
      const scrollingDown = deltaY > 0;
      const scrollingUp = deltaY < 0;

      if ((scrollingDown && !atBottom) || (scrollingUp && !atTop)) {
        e.preventDefault();
        e.stopPropagation();
        scrollEl.scrollTop = Math.min(maxScroll, Math.max(0, scrollTop + deltaY));
      }
    };

    scrollEl.addEventListener("wheel", onWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", onWheel);
  }, [scrollRef, enabled]);
}
