import type { CatalogStoredObjectDescriptor } from "@bino-foundry/shared";
import { STORAGE_BUCKET_IDS, type StorageBucketId } from "@bino-foundry/shared";

import { getEnv } from "../../config/env.js";
import { ValidationError } from "../../lib/errors.js";
import { getSupabaseServiceRole } from "../supabase/adminClient.js";

const PUBLIC_BUCKETS = new Set<string>(["frames", "crystals", "assets"]);

function isStorageBucketId(value: string): value is StorageBucketId {
  return (STORAGE_BUCKET_IDS as readonly string[]).includes(value);
}

export function catalogStorageConfigured(): boolean {
  const e = getEnv();
  return Boolean(e.SUPABASE_URL?.trim() && e.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function assertCatalogBucket(value: unknown, label = "bucket"): StorageBucketId {
  if (typeof value !== "string" || !isStorageBucketId(value)) {
    throw new ValidationError(`${label} must be one of: ${STORAGE_BUCKET_IDS.join(", ")}`);
  }
  return value;
}

/** Supabase CDN-style HTTPS URL for public catalogue buckets (`getPublicUrl`). */
export function publicCatalogHttpUrl(bucket: StorageBucketId, objectKey: string): string | null {
  const b = bucket;
  if (!PUBLIC_BUCKETS.has(b)) return null;

  const supabase = getSupabaseServiceRole();
  const { data } = supabase.storage.from(b).getPublicUrl(objectKey.trim());
  return data.publicUrl;
}

/** Write-through upload (staging or promotion). Prefer immutable keys (`upsert: false`) for catalogues. */
export async function putCatalogObject(params: {
  bucket: string;
  objectKey: string;
  body: Uint8Array | ArrayBuffer | Buffer;
  contentType: string;
  upsert?: boolean;
  cacheControl?: string;
}): Promise<CatalogStoredObjectDescriptor> {
  const bucket = assertCatalogBucket(params.bucket);
  const key = params.objectKey.trim().replace(/^\/+/, "");

  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.storage.from(bucket).upload(key, params.body, {
    upsert: params.upsert ?? false,
    contentType: params.contentType,
    cacheControl: params.cacheControl,
  });

  if (error) {
    throw new ValidationError(`Storage upload failed: ${error.message}`, error);
  }

  return {
    provider: "supabase-storage",
    bucket,
    objectKey: key,
    publicUrl: publicCatalogHttpUrl(bucket, key),
  };
}

/**
 * Streams an object server-side between buckets — **promotion** from private `uploads` into catalogue buckets,
 * without sending bytes through browsers.
 */
export async function promoteCatalogObject(params: {
  fromBucket: string;
  fromKey: string;
  toBucket: string;
  toKey: string;
  contentType: string;
  cacheControl?: string;
}): Promise<CatalogStoredObjectDescriptor> {
  const fromBucket = assertCatalogBucket(params.fromBucket);
  const toBucket = assertCatalogBucket(params.toBucket);
  const fromKey = params.fromKey.trim().replace(/^\/+/, "");
  const toKey = params.toKey.trim().replace(/^\/+/, "");

  const supabase = getSupabaseServiceRole();

  const { data: file, error: downloadError } = await supabase.storage.from(fromBucket).download(fromKey);

  if (downloadError || !file) {
    throw new ValidationError(
      downloadError?.message ?? "Storage download returned empty response",
      downloadError ?? undefined,
    );
  }

  const binary = Buffer.from(await file.arrayBuffer());

  return putCatalogObject({
    bucket: toBucket,
    objectKey: toKey,
    body: binary,
    contentType: params.contentType,
    upsert: true,
    cacheControl: params.cacheControl,
  });
}
