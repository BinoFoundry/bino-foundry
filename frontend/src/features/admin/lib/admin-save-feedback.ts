import { toast } from "sonner";

import { formatApiErrorMessage, isApiError } from "@/services/api";

export function notifyAdminSavedEdit(message = "Changes saved successfully."): void {
  toast.success(message);
}

export function notifyAdminCreated(resourceLabel: string): void {
  toast.success(`${resourceLabel} created — continue configuring.`);
}

export function notifyAdminSaveFailed(err: unknown, fallback = "Could not save changes."): void {
  if (isApiError(err)) {
    if (err.status === 401) {
      toast.error(err.message || "Your session has expired. Please sign in again.");
      return;
    }
    if (err.status === 403) {
      toast.error(err.message || "You do not have permission to perform this action.");
      return;
    }
    if (err.status >= 500) {
      toast.error(err.message || "Server error. Please try again.");
      return;
    }
    toast.error(err.message || formatApiErrorMessage(err) || fallback);
    return;
  }
  toast.error(formatApiErrorMessage(err) || fallback);
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
