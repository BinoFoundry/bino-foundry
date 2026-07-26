import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import {
  rollbackUploadedUrls,
  uploadValidatedImage,
} from "@/features/admin/lib/upload-pipeline";

/** Maps blob: preview URLs → File so Save can promote without orphaning early uploads. */
const pendingFilesByBlobUrl = new Map<string, File>();

export function registerPendingGlassSheet(blobUrl: string, file: File): void {
  pendingFilesByBlobUrl.set(blobUrl, file);
}

export function peekPendingGlassSheet(blobUrl: string | null | undefined): File | null {
  if (!blobUrl?.startsWith("blob:")) return null;
  return pendingFilesByBlobUrl.get(blobUrl) ?? null;
}

export function discardPendingGlassSheet(blobUrl: string | null | undefined): void {
  if (!blobUrl?.startsWith("blob:")) return;
  pendingFilesByBlobUrl.delete(blobUrl);
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // ignore
  }
}

/**
 * Promote a draft blob sheet to permanent storage (or clear), and delete the previous
 * permanent file when replaced or removed. Call only from Save handlers.
 */
export async function finalizeGlassSheetSettings(
  settings: LensClipRenderSettings,
  previouslySavedUrl: string | null | undefined,
): Promise<LensClipRenderSettings> {
  const next: LensClipRenderSettings = { ...settings };
  const current = next.glassSheetUrl?.trim() || null;
  const previous = previouslySavedUrl?.trim() || null;

  if (current?.startsWith("blob:")) {
    const file = pendingFilesByBlobUrl.get(current);
    pendingFilesByBlobUrl.delete(current);
    if (!file) {
      discardPendingGlassSheet(current);
      throw new Error("Glass sheet draft is missing — please upload again");
    }
    const permanentUrl = await uploadValidatedImage(file);
    try {
      URL.revokeObjectURL(current);
    } catch {
      // ignore
    }
    next.glassSheetUrl = permanentUrl;
    if (previous && previous !== permanentUrl) {
      await rollbackUploadedUrls([previous]);
    }
    return next;
  }

  if (!current && previous) {
    await rollbackUploadedUrls([previous]);
    next.glassSheetUrl = null;
    next.glassSheetNaturalWidth = null;
    next.glassSheetNaturalHeight = null;
    next.glassSheetCrop = null;
    return next;
  }

  return next;
}

export function isGlassSheetBlobUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("blob:"));
}
