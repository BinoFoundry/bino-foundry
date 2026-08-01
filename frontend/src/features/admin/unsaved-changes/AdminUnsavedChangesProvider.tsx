import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router-dom";

import { ADMIN_UNSAVED_COPY } from "./copy";
import { AdminUnsavedLeaveDialog } from "./AdminUnsavedLeaveDialog";
import { shouldBlockAdminNavigation } from "./should-block-navigation";

type ProceedFn = () => void;

interface AdminUnsavedChangesContextValue {
  /** True when any registered editor reports dirty. */
  isDirty: boolean;
  /** Register/update dirty state for a source id. Clears on unmount via hook. */
  setSourceDirty: (sourceId: string, dirty: boolean) => void;
  /**
   * Synchronously clear dirty for a source (and optionally all sources) so a
   * subsequent navigate in the same tick is not blocked as "unsaved".
   */
  clearDirtySync: (sourceId?: string) => void;
  /**
   * Run `proceed` immediately when clean; otherwise open the leave dialog and
   * only call `proceed` if the user confirms Leave Without Saving.
   */
  confirmLeave: (proceed: ProceedFn) => void;
}

const AdminUnsavedChangesContext = createContext<AdminUnsavedChangesContextValue | null>(null);

export function AdminUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtySources, setDirtySources] = useState<Record<string, true>>({});
  const [pendingProceed, setPendingProceed] = useState<ProceedFn | null>(null);
  /** Sync mirror for useBlocker — React state alone is one tick too late after Save→navigate. */
  const dirtySourcesRef = useRef<Record<string, true>>({});

  const isDirty = Object.keys(dirtySources).length > 0;

  const setSourceDirty = useCallback((sourceId: string, dirty: boolean) => {
    const has = Boolean(dirtySourcesRef.current[sourceId]);
    if (dirty && has) return;
    if (!dirty && !has) return;
    const next = { ...dirtySourcesRef.current };
    if (dirty) next[sourceId] = true;
    else delete next[sourceId];
    dirtySourcesRef.current = next;
    setDirtySources(next);
  }, []);

  const clearDirtySync = useCallback((sourceId?: string) => {
    if (sourceId) {
      if (!dirtySourcesRef.current[sourceId]) return;
      const next = { ...dirtySourcesRef.current };
      delete next[sourceId];
      dirtySourcesRef.current = next;
      setDirtySources(next);
      return;
    }
    if (Object.keys(dirtySourcesRef.current).length === 0) return;
    dirtySourcesRef.current = {};
    setDirtySources({});
  }, []);

  const confirmLeave = useCallback((proceed: ProceedFn) => {
    if (Object.keys(dirtySourcesRef.current).length === 0) {
      proceed();
      return;
    }
    setPendingProceed(() => proceed);
  }, []);

  // Browser refresh / close tab / close window.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(dirtySourcesRef.current).length === 0) return;
      event.preventDefault();
      event.returnValue = ADMIN_UNSAVED_COPY.beforeUnload;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // In-app navigation: sidebar, back/forward, deep links, logo, etc.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldBlockAdminNavigation(
      Object.keys(dirtySourcesRef.current).length > 0,
      currentLocation.pathname,
      nextLocation.pathname,
    ),
  );
  const routeBlocked = blocker.state === "blocked";
  const dialogOpen = routeBlocked || pendingProceed != null;

  const handleStay = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset();
    setPendingProceed(null);
  }, [blocker]);

  const handleLeave = useCallback(() => {
    const proceed = pendingProceed;
    setPendingProceed(null);
    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }
    proceed?.();
  }, [blocker, pendingProceed]);

  const value = useMemo(
    () => ({ isDirty, setSourceDirty, clearDirtySync, confirmLeave }),
    [isDirty, setSourceDirty, clearDirtySync, confirmLeave],
  );

  return (
    <AdminUnsavedChangesContext.Provider value={value}>
      {children}
      <AdminUnsavedLeaveDialog open={dialogOpen} onStay={handleStay} onLeave={handleLeave} />
    </AdminUnsavedChangesContext.Provider>
  );
}

export function useAdminUnsavedChangesContext(): AdminUnsavedChangesContextValue {
  const ctx = useContext(AdminUnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChangesGuard must be used within AdminUnsavedChangesProvider");
  }
  return ctx;
}

/**
 * Standalone confirm helper when a provider is present. Safe no-op proceed when outside admin.
 */
export function useOptionalAdminUnsavedChanges(): AdminUnsavedChangesContextValue | null {
  return useContext(AdminUnsavedChangesContext);
}
