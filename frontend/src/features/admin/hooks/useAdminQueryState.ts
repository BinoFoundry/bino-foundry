import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type ParamValue = string | number | boolean | null | undefined;

function serializeValue(value: ParamValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

/**
 * Sync a single search-param key with the URL (source of truth).
 * Omits the key when value is empty / default.
 */
export function useAdminQueryParam(
  key: string,
  defaultValue = "",
  options?: { replace?: boolean },
): [string, (next: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const replace = options?.replace ?? true;
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!next || next === defaultValue) params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace },
      );
    },
    [key, defaultValue, replace, setSearchParams],
  );

  return [value, setValue];
}

/**
 * Batch read/write helper for admin list filters stored in the query string.
 */
export function useAdminQueryState<T extends Record<string, ParamValue>>(
  defaults: T,
  options?: { replace?: boolean },
): [T, (patch: Partial<T>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const replace = options?.replace ?? true;

  const state = useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const raw = searchParams.get(String(key));
      if (raw === null) continue;
      const fallback = defaults[key];
      if (typeof fallback === "number") {
        const n = Number(raw);
        next[key] = (Number.isFinite(n) ? n : fallback) as T[keyof T];
      } else if (typeof fallback === "boolean") {
        next[key] = (raw === "1" || raw === "true") as T[keyof T];
      } else {
        next[key] = raw as T[keyof T];
      }
    }
    return next;
  }, [searchParams, defaults]);

  const setState = useCallback(
    (patch: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const serialized = serializeValue(value as ParamValue);
            const defaultSerialized = serializeValue(defaults[key as keyof T]);
            if (serialized === null || serialized === defaultSerialized) {
              params.delete(key);
            } else {
              params.set(key, serialized);
            }
          }
          return params;
        },
        { replace },
      );
    },
    [defaults, replace, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) params.delete(key);
        return params;
      },
      { replace },
    );
  }, [defaults, replace, setSearchParams]);

  return [state, setState, reset];
}
