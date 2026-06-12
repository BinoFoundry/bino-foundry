/**
 * Stable constants shared by frontend/backend to avoid drift.
 */

/** Target API prefix once Express routes are versioned (frontend may still use `/api` until migrated). */
export const API_VERSION_PREFIX = "/api/v1" as const;

/** Phase 1 Express catalogue mount (matches current server). */
export const API_LEGACY_PREFIX = "/api" as const;

/** Supabase-ready bucket identifiers (implement upload routes per Phase roadmap) */
export const STORAGE_BUCKET_IDS = [
  "frames",
  "crystals",
  "assets",
  "uploads",
] as const;

export type StorageBucketId = (typeof STORAGE_BUCKET_IDS)[number];

export * from "./customer-name.js";
