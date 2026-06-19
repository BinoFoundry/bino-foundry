import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SectionRefreshConfig } from "../admin-refresh";

interface AdminSectionRefreshContextValue {
  override: SectionRefreshConfig | null;
  setOverride: (config: SectionRefreshConfig | null) => void;
}

const AdminSectionRefreshContext = createContext<AdminSectionRefreshContextValue | null>(null);

export function AdminSectionRefreshProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<SectionRefreshConfig | null>(null);

  const setOverride = useCallback((config: SectionRefreshConfig | null) => {
    setOverrideState(config);
  }, []);

  const value = useMemo(
    () => ({
      override,
      setOverride,
    }),
    [override, setOverride],
  );

  return (
    <AdminSectionRefreshContext.Provider value={value}>{children}</AdminSectionRefreshContext.Provider>
  );
}

/** Register a page-specific refresh handler that overrides the section default. */
export function useAdminSectionRefresh(label: string, action: () => Promise<void>) {
  const context = useContext(AdminSectionRefreshContext);
  if (!context) {
    throw new Error("useAdminSectionRefresh must be used within AdminSectionRefreshProvider");
  }

  const { setOverride } = context;

  useEffect(() => {
    setOverride({ label, action });
    return () => setOverride(null);
  }, [label, action, setOverride]);
}

export function useAdminSectionRefreshOverride(): SectionRefreshConfig | null {
  const context = useContext(AdminSectionRefreshContext);
  if (!context) {
    throw new Error("useAdminSectionRefreshOverride must be used within AdminSectionRefreshProvider");
  }
  return context.override;
}
