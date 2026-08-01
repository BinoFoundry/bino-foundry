import { useCallback, useEffect, useRef, useState } from "react";

import { stableSerialize } from "./stable-serialize";

/**
 * Tracks whether `value` differs from a baseline captured on mount / when `baselineKey` changes.
 * Call `markClean()` after a successful save to adopt the current value as the new baseline.
 */
export function useDirtySnapshot<T>(value: T, baselineKey: string | number | null | undefined = "default") {
  const [baseline, setBaseline] = useState(() => stableSerialize(value));
  const keyRef = useRef(baselineKey);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (keyRef.current === baselineKey) return;
    keyRef.current = baselineKey;
    setBaseline(stableSerialize(valueRef.current));
  }, [baselineKey]);

  const isDirty = stableSerialize(value) !== baseline;

  const markClean = useCallback(() => {
    setBaseline(stableSerialize(valueRef.current));
  }, []);

  const resetBaseline = useCallback((next: T) => {
    setBaseline(stableSerialize(next));
  }, []);

  return { isDirty, markClean, resetBaseline };
}
