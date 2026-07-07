import { uploadService } from "../upload/upload.service.js";

type DeliveryUrls = { avif?: string; webp?: string; png?: string } | null | undefined;

export function pushCatalogAssetUrl(urls: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed && !trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
    urls.add(trimmed);
  }
}

export function pushCatalogDeliveryUrls(urls: Set<string>, delivery: DeliveryUrls): void {
  if (!delivery || typeof delivery !== "object") return;
  pushCatalogAssetUrl(urls, delivery.avif);
  pushCatalogAssetUrl(urls, delivery.webp);
  pushCatalogAssetUrl(urls, delivery.png);
}

/** Delete catalogue objects referenced by public URLs (ignores unknown hosts). */
export async function deleteCatalogAssetUrls(publicUrls: string[]): Promise<void> {
  for (const url of publicUrls) {
    try {
      await uploadService.deleteUploadedPublicUrl(url);
    } catch {
      // Best-effort — DB row is already removed; orphan cleanup can be retried manually.
    }
  }
}
