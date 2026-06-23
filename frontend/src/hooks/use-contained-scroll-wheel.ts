import { useEffect, type RefObject } from "react";

const EDGE_THRESHOLD_PX = 2;

/**
 * Keeps wheel / trackpad scroll inside a panel until the top or bottom edge is reached,
 * then allows the event to propagate so the parent page can scroll.
 */
export function useContainedScrollWheel(
  scrollRef: RefObject<HTMLElement | null>,
  captureRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const captureEl = captureRef.current;
    if (!scrollEl || !captureEl || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      if (!captureEl.contains(e.target as Node)) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= EDGE_THRESHOLD_PX) return;

      const atTop = scrollTop <= EDGE_THRESHOLD_PX;
      const atBottom = scrollTop >= maxScroll - EDGE_THRESHOLD_PX;
      const dy = e.deltaY;

      const scrollingDown = dy > 0;
      const scrollingUp = dy < 0;

      if ((scrollingDown && !atBottom) || (scrollingUp && !atTop)) {
        e.preventDefault();
        e.stopPropagation();
        scrollEl.scrollTop = Math.min(maxScroll, Math.max(0, scrollTop + dy));
      }
    };

    captureEl.addEventListener("wheel", onWheel, { passive: false });
    return () => captureEl.removeEventListener("wheel", onWheel);
  }, [scrollRef, captureRef, enabled]);
}
