import { toast } from "sonner";

import { formatApiErrorMessage, isApiError } from "@/services/api";

export function notifyAdminSavedEdit(message = "Changes saved successfully."): void {
  toast.success(message);
}

export function notifyAdminCreated(resourceLabel: string): void {
  toast.success(`${resourceLabel} created — continue configuring.`);
}

export function notifyAdminDeleted(resourceLabel = "Item"): void {
  toast.success(`${resourceLabel} deleted successfully.`);
}

/** Map API failures to admin-facing copy (no env vars / auth implementation details). */
function adminFacingSaveError(err: unknown, fallback: string): string {
  if (!isApiError(err)) {
    return formatApiErrorMessage(err) || fallback;
  }

  if (err.status === 401) {
    if (err.code === "SESSION_EXPIRED") {
      return "Your session has expired. Please sign in again.";
    }
    return "You do not have permission to modify this catalogue.";
  }

  if (err.status === 403) {
    return "You do not have permission to modify this catalogue.";
  }

  if (err.status >= 500 || err.code === "NETWORK_ERROR" || err.code === "GATEWAY_ERROR") {
    return "Something went wrong while saving your changes. Please try again.";
  }

  // Prefer generic save copy over raw backend auth/config phrasing.
  const raw = (err.message || "").trim();
  if (!raw || /api[_ -]?key|ADMIN_API|authentication required/i.test(raw)) {
    return fallback;
  }

  return raw;
}

export function notifyAdminSaveFailed(
  err: unknown,
  fallback = "Unable to save changes. Please try again.",
): void {
  toast.error(adminFacingSaveError(err, fallback));
}

export function notifyAdminDeleteFailed(
  err: unknown,
  fallback = "Unable to delete. Please try again.",
): void {
  notifyAdminSaveFailed(err, fallback);
}

export type AdminEditorModalState<T> = { type: "add" } | { type: "edit"; entry: T } | null;

/** After save: stay on edit for updates; open edit after create. */
export function applyAdminSaveModalState<T extends { id: string }>(
  mode: "add" | "edit",
  saved: T,
  setModal: (state: AdminEditorModalState<T>) => void,
  options?: { createdLabel?: string },
): void {
  if (mode === "add") {
    notifyAdminCreated(options?.createdLabel ?? "Item");
  } else {
    notifyAdminSavedEdit();
  }
  setModal({ type: "edit", entry: saved });
}
