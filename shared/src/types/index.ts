/**
 * Cross-package types (minimal for Phase 1).
 * Extend as API contracts stabilize.
 */

export type ProductId = string;

export interface ApiErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export * from "./bead-crop.js";
export * from "./bead-variant.js";
export * from "./bracelet-config.js";
export * from "./lens-clip.js";
export * from "./lens-tint-render.js";
export * from "./saved-design.js";
export * from "./rbac.js";
export * from "./user-management.js";
export * from "./site-settings.js";
export * from "./smtp-settings.js";
export * from "./email-log.js";
