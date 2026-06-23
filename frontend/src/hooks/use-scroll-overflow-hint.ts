import { useCallback, useEffect, useState, type RefObject } from "react";

const BOTTOM_THRESHOLD_PX = 32;

/**
 * Tracks whether a scroll container has content below the visible fold.
 * Re-evaluates on scroll, resize, and when `deps` change (e.g. step switch).
 */
export function useScrollOverflowHint(
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
): boolean {
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  const evaluate = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setHasMoreBelow(false);
      return;
    }
    const canScroll = el.scrollHeight > el.clientHeight + 4;
    const atBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_THRESHOLD_PX;
    setHasMoreBelow(canScroll && !atBottom);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    evaluate();
    el.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);

    const observer = new ResizeObserver(evaluate);
    observer.observe(el);
    for (const child of el.children) {
      observer.observe(child);
    }

    return () => {
      el.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
      observer.disconnect();
    };
  }, [evaluate, ref, ...deps]);

  return hasMoreBelow;
}
