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
