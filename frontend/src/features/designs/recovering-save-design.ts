import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

import { isApiError } from "@/services/api/errors";

export type SaveDesignFn = (
  request: SaveDesignRequest,
  options?: { designId?: string; silent?: boolean },
) => Promise<SavedDesignSummary | null>;

/**
 * Wraps builder save so a stale/missing design id (404) falls back to create once,
 * then clears the invalid id from local state.
 */
export function createRecoveringSaveDesign(
  saveDesign: SaveDesignFn,
  onStaleDesignId: () => void,
): SaveDesignFn {
  return async (request, options) => {
    try {
      return await saveDesign(request, options);
    } catch (err) {
      if (isApiError(err) && err.status === 404 && options?.designId) {
        onStaleDesignId();
        return saveDesign(request, { ...options, designId: undefined, silent: options?.silent });
      }
      throw err;
    }
  };
}

/** After hydration fails, stop re-fetching and allow a fresh create on next edit. */
export function clearStaleDesignUrl(
  designIdFromUrl: string | null,
  setSavedDesignId: (id: string | null) => void,
  setSearchParams: (next: Record<string, string>, opts?: { replace?: boolean }) => void,
): void {
  setSavedDesignId(null);
  if (designIdFromUrl) {
    setSearchParams({}, { replace: true });
  }
}
