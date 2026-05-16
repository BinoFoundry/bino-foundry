import type { StorageBucketId } from "../constants/index.js";

/** Vendor-neutral handle returned by catalogue upload APIs once an object lands in Storage. */
export interface CatalogStoredObjectDescriptor {
  provider: "supabase-storage";
  bucket: StorageBucketId;
  objectKey: string;
  /** Only set for buckets with anonymous read (`frames`, `crystals`, `assets`). */
  publicUrl?: string | null;
}
