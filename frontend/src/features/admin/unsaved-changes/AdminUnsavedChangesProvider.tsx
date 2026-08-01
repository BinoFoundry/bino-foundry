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

type ProceedFn = () => void;

interface AdminUnsavedChangesContextValue {
  /** True when any registered editor reports dirty. */
  isDirty: boolean;
  /** Register/update dirty state for a source id. Clears on unmount via hook. */
  setSourceDirty: (sourceId: string, dirty: boolean) => void;
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

  const isDirty = Object.keys(dirtySources).length > 0;

  const setSourceDirty = useCallback((sourceId: string, dirty: boolean) => {
    setDirtySources((prev) => {
      const has = Boolean(prev[sourceId]);
      if (dirty && has) return prev;
      if (!dirty && !has) return prev;
      const next = { ...prev };
      if (dirty) next[sourceId] = true;
      else delete next[sourceId];
      return next;
    });
  }, []);

  const confirmLeave = useCallback(
    (proceed: ProceedFn) => {
      if (!isDirty) {
        proceed();
        return;
      }
      setPendingProceed(() => proceed);
    },
    [isDirty],
  );

  // Browser refresh / close tab / close window.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = ADMIN_UNSAVED_COPY.beforeUnload;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // In-app navigation: sidebar, back/forward, deep links, logo, etc.
  const blocker = useBlocker(isDirty);
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
    () => ({ isDirty, setSourceDirty, confirmLeave }),
    [isDirty, setSourceDirty, confirmLeave],
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
