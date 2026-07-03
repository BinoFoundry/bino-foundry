import { isApiError } from "@/services/api";
import { uploadApi } from "@/services/api/upload";

/** MIME types allowed by the Supabase `assets` bucket and upload route. */
export const UPLOADABLE_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const MIN_UPLOAD_INTERVAL_MS = 200;
let lastUploadStartedAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validate a file before POST /api/upload — returns an error message or null when OK. */
export function validateUploadFile(file: File | null | undefined): string | null {
  if (!file) return "No file provided";
  if (!Number.isFinite(file.size) || file.size <= 0) return "File is empty";
  if (!file.name?.trim()) return "Filename is missing";
  const mime = file.type?.trim().toLowerCase() ?? "";
  if (!mime || !UPLOADABLE_IMAGE_MIME_TYPES.has(mime)) {
    return `Unsupported mime type: ${mime || "unknown"}`;
  }
  return null;
}

/** SHA-256 hex digest for bitmap deduplication. */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashRemoteBlob(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return hashBlob(blob);
  } catch {
    return null;
  }
}

/** Compare exported bitmap against an existing stored asset URL. */
export async function blobMatchesRemoteAsset(
  blob: Blob,
  existingUrl: string | null | undefined,
): Promise<boolean> {
  if (!existingUrl?.trim() || !blob.size) return false;
  const [localHash, remoteHash] = await Promise.all([
    hashBlob(blob),
    hashRemoteBlob(existingUrl.trim()),
  ]);
  return remoteHash != null && localHash === remoteHash;
}

/**
 * Upload one validated image — sequential throttle, no retries.
 * Never sends invalid FormData to the API.
 */
export async function uploadValidatedImage(
  file: File,
  options?: { throttle?: boolean },
): Promise<string> {
  const validationError = validateUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (options?.throttle !== false) {
    const now = Date.now();
    const wait = Math.max(0, MIN_UPLOAD_INTERVAL_MS - (now - lastUploadStartedAt));
    if (wait > 0) await delay(wait);
    lastUploadStartedAt = Date.now();
  }

  const result = await uploadApi.uploadImage(file);
  const url = result.imageUrl?.trim();
  if (!url) {
    throw new Error("Upload succeeded but returned no image URL");
  }
  return url;
}

/** Build a user-facing upload error message. */
export function formatUploadErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 413) {
      return "Image is too large. Please use a file under 50 MB.";
    }
    if (error.status === 415) {
      return "Unsupported image format. Please upload PNG, JPEG, or WebP.";
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return "Unable to upload image. Please try again.";
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Unable to upload image. Please try again.";
}

/** Best-effort rollback after a partial multi-file upload. */
export async function rollbackUploadedUrls(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await uploadApi.deleteUploadedAsset(url);
      } catch {
        // Rollback is best-effort.
      }
    }),
  );
}

/** Reset throttle clock (tests). */
export function resetUploadThrottleForTests(): void {
  lastUploadStartedAt = 0;
}
