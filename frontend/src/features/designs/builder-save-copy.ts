import type { DesignAutoSaveStatus } from "./design-autosave-controller";

export const BUILDER_SAVE_COPY = {
  saving: "Saving...",
  saved: "All changes saved",
  pending: "Unsaved changes",
  offline: "Offline — changes will sync later",
  error: "Save failed",
  signInToSave: "Sign in to save your design",
} as const;

export function labelForAutoSaveStatus(status: DesignAutoSaveStatus): string | null {
  switch (status) {
    case "saving":
      return BUILDER_SAVE_COPY.saving;
    case "saved":
      return BUILDER_SAVE_COPY.saved;
    case "pending":
      return BUILDER_SAVE_COPY.pending;
    case "offline":
      return BUILDER_SAVE_COPY.offline;
    case "error":
      return BUILDER_SAVE_COPY.error;
    default:
      return null;
  }
}

export const LEAVE_PAGE_WARNING = "You have unsaved changes. Are you sure you want to leave?";
