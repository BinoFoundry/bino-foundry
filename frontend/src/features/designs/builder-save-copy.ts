import type { DesignAutoSaveStatus } from "./use-design-auto-save";

export const BUILDER_SAVE_COPY: Record<Exclude<DesignAutoSaveStatus, "idle">, string> = {
  pending: "Changes pending…",
  saving: "Saving…",
  saved: "All changes saved",
  offline: "Offline — changes will sync later",
  error: "Couldn't save — will retry when you edit",
};

export function builderSaveStatusLabel(status: DesignAutoSaveStatus): string | null {
  if (status === "idle") return null;
  return BUILDER_SAVE_COPY[status];
}
