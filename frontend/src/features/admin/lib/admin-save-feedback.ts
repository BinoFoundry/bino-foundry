import { toast } from "sonner";

import { formatApiErrorMessage, isApiError } from "@/services/api";

export function notifyAdminSavedEdit(message = "Changes saved successfully."): void {
  toast.success(message);
}

export function notifyAdminCreated(resourceLabel: string): void {
  toast.success(`${resourceLabel} created — continue configuring.`);
}

export function notifyAdminSaveFailed(err: unknown, fallback = "Could not save changes."): void {
  toast.error(isApiError(err) ? err.message : formatApiErrorMessage(err) || fallback);
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
