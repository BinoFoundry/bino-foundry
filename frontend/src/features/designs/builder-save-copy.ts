import type { DesignAutoSaveStatus } from "./design-autosave-controller";

export const BUILDER_SAVE_COPY = {
  saving: "Saving...",
  saved: "Saved",
  pending: "● Unsaved Changes",
  offline: "Offline — save when you're back online",
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

export const LEAVE_PAGE_WARNING =
  "You have unsaved changes. If you leave now, your recent edits will be lost.";

export const BUILDER_DRAFT_RECOVERY_COPY = {
  title: "Restore your previous edits?",
  description: "You have unsaved changes from a previous session. Continue where you left off?",
  restore: "Restore",
  discard: "Discard",
} as const;

export const BUILDER_UNSAVED_LEAVE_COPY = {
  title: "You have unsaved changes",
  description: "If you leave now, your recent edits will be lost.",
  stay: "Stay",
  leave: "Leave",
} as const;
