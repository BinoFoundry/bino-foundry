import { useCallback, useEffect, useRef, useState } from "react";

import { stableSerialize } from "./stable-serialize";

/**
 * Tracks whether `value` differs from a baseline captured when `baselineKey` is set
 * (and re-captured once after mount/key change so editor hydration does not look like a user edit).
 *
 * Call `markClean()` after a successful save to adopt the current value as the new baseline.
 */
export function useDirtySnapshot<T>(value: T, baselineKey: string | number | null | undefined = "default") {
  const serialized = stableSerialize(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  const [baseline, setBaseline] = useState(serialized);
  const [prevKey, setPrevKey] = useState(baselineKey);

  // Same-render baseline reset when the edited entity changes (open another record / create).
  if (prevKey !== baselineKey) {
    setPrevKey(baselineKey);
    setBaseline(serialized);
  }

  // Absorb one tick of mount/hydration noise (crop editors, normalized defaults, etc.).
  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      // Second frame: async editor init often lands here.
      requestAnimationFrame(() => {
        if (cancelled) return;
        setBaseline(stableSerialize(valueRef.current));
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [baselineKey]);

  const isDirty = serialized !== baseline;

  const markClean = useCallback(() => {
    setBaseline(stableSerialize(valueRef.current));
  }, []);

  const resetBaseline = useCallback((next: T) => {
    setBaseline(stableSerialize(next));
  }, []);

  return { isDirty, markClean, resetBaseline };
}
