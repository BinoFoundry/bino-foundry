import type { SunglassesRenderOptions } from "@/render/types";

const STORAGE_KEY = "bino-sunglasses-customiser-v1";

export interface CustomiserSession {
  frameSkuId: string;
  selectedTintId: string | null;
  options: SunglassesRenderOptions;
}

export function loadCustomiserSession(): Partial<CustomiserSession> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomiserSession>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCustomiserSession(session: CustomiserSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearCustomiserSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
