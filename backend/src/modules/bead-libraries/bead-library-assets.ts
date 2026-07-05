import { uploadService } from "../upload/upload.service.js";

type DeliveryUrls = { avif?: string; webp?: string; png?: string } | null | undefined;
type NormalizedDeliveryUrls = DeliveryUrls;

function pushUrl(urls: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed && !trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
    urls.add(trimmed);
  }
}

function pushDeliveryUrls(urls: Set<string>, delivery: DeliveryUrls): void {
  if (!delivery || typeof delivery !== "object") return;
  pushUrl(urls, delivery.avif);
  pushUrl(urls, delivery.webp);
  pushUrl(urls, delivery.png);
}

/** Collect every storage URL owned by a bead library row and its size offers. */
export function collectBeadLibraryAssetUrls(
  library: Record<string, unknown>,
  sizeRows: Record<string, unknown>[] = [],
): string[] {
  const urls = new Set<string>();

  pushUrl(urls, library.original_image_url);
  pushUrl(urls, library.processed_image_url);

  const specs = library.specs;
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    pushUrl(urls, (specs as { legacy_image_url?: string }).legacy_image_url);
  }

  const cropConfig = library.crop_config;
  if (cropConfig && typeof cropConfig === "object" && !Array.isArray(cropConfig)) {
    const crop = cropConfig as {
      originalUrl?: string;
      processedUrl?: string;
      deliveryUrls?: DeliveryUrls;
    };
    pushUrl(urls, crop.originalUrl);
    pushUrl(urls, crop.processedUrl);
    pushDeliveryUrls(urls, crop.deliveryUrls);
  }

  for (const row of sizeRows) {
    pushUrl(urls, row.normalized_processed_image_url);
    pushDeliveryUrls(urls, row.normalized_delivery_urls as NormalizedDeliveryUrls);
  }

  return [...urls];
}

/** Delete catalogue objects referenced by public URLs (ignores unknown hosts). */
export async function deleteBeadLibraryAssetUrls(publicUrls: string[]): Promise<void> {
  for (const url of publicUrls) {
    try {
      await uploadService.deleteUploadedPublicUrl(url);
    } catch {
      // Best-effort — DB row is already removed; orphan cleanup can be retried manually.
    }
  }
}
