import { useCallback, useEffect, useState } from "react";

/** Enable via console: localStorage.setItem('bino-admin-developer-mode', '1') */
export const ADMIN_DEVELOPER_MODE_KEY = "bino-admin-developer-mode";

export function isAdminDeveloperMode(): boolean {
  if (import.meta.env.VITE_ADMIN_DEVELOPER_MODE === "true") return true;
  try {
    return localStorage.getItem(ADMIN_DEVELOPER_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminDeveloperMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(ADMIN_DEVELOPER_MODE_KEY, "1");
    else localStorage.removeItem(ADMIN_DEVELOPER_MODE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("bino-admin-developer-mode"));
}

export function useAdminDeveloperMode(): boolean {
  const [enabled, setEnabled] = useState(isAdminDeveloperMode);

  useEffect(() => {
    const sync = () => setEnabled(isAdminDeveloperMode());
    window.addEventListener("bino-admin-developer-mode", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bino-admin-developer-mode", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return enabled;
}

export function useToggleAdminDeveloperMode(): [boolean, () => void] {
  const enabled = useAdminDeveloperMode();
  const toggle = useCallback(() => {
    setAdminDeveloperMode(!enabled);
  }, [enabled]);
  return [enabled, toggle];
}
