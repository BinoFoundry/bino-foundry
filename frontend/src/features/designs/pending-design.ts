import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

const PENDING_KEY = "bino-pending-design-v1";

export interface PendingDesignSave {
  request: SaveDesignRequest;
  designId?: string;
}

export function storePendingDesign(pending: PendingDesignSave): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

export function loadPendingDesign(): PendingDesignSave | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingDesignSave;
  } catch {
    return null;
  }
}

export function clearPendingDesign(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export type PendingDesignListener = (result: SavedDesignSummary | null) => void;

let pendingListener: PendingDesignListener | null = null;

export function setPendingDesignListener(listener: PendingDesignListener | null) {
  pendingListener = listener;
}

export function notifyPendingDesignComplete(result: SavedDesignSummary | null) {
  pendingListener?.(result);
}
