import { useEffect, useId } from "react";

import { useAdminUnsavedChangesContext } from "./AdminUnsavedChangesProvider";

export interface UseUnsavedChangesGuardResult {
  /** True when this source or any other registered admin editor is dirty. */
  isDirty: boolean;
  /**
   * Wrap Cancel / Back / close-editor actions that do not go through the router.
   * Route changes (sidebar, browser back) are blocked automatically when dirty.
   */
  confirmLeave: (proceed: () => void) => void;
}

/**
 * Register an editor's dirty state with the Admin unsaved-changes guard.
 *
 * @example
 * const { isDirty, markClean } = useDirtySnapshot(form, initial?.id ?? "new");
 * const { confirmLeave } = useUnsavedChangesGuard(isDirty);
 * <Button onClick={() => confirmLeave(onCancel)}>Cancel</Button>
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  sourceId?: string,
): UseUnsavedChangesGuardResult {
  const autoId = useId();
  const id = sourceId ?? autoId;
  const { isDirty, setSourceDirty, confirmLeave } = useAdminUnsavedChangesContext();

  useEffect(() => {
    setSourceDirty(id, dirty);
    return () => setSourceDirty(id, false);
  }, [id, dirty, setSourceDirty]);

  return { isDirty: isDirty || dirty, confirmLeave };
}
