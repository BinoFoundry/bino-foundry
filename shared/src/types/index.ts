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

export * from "./asset-normalization.js";
export * from "./crop-occupancy.js";
export * from "./mm-group-normalization.js";
export * from "./bead-crop.js";
export * from "./bead-variant.js";
export * from "./bracelet-config.js";
export * from "./lens-clip.js";
export * from "./lens-render-config.js";
export * from "./lens-tint-render.js";
export * from "./strand-contact-geometry.js";
export * from "./strand-render-profile.js";
export * from "./strand-render-config.js";
export * from "./strand-render-migration.js";
export * from "./saved-design.js";
export * from "./rbac.js";
export * from "./user-management.js";
export * from "./bead-render-calibration.js";
export * from "./how-we-prepare.js";
export * from "./site-settings.js";
export * from "./smtp-settings.js";
export * from "./email-log.js";
