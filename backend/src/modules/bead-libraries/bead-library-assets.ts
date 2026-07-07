import {
  deleteCatalogAssetUrls,
  pushCatalogAssetUrl,
  pushCatalogDeliveryUrls,
} from "../catalog-lifecycle/catalog-asset-cleanup.js";

/** Collect every storage URL owned by a bead library row and its size offers. */
export function collectBeadLibraryAssetUrls(
  library: Record<string, unknown>,
  sizeRows: Record<string, unknown>[] = [],
): string[] {
  const urls = new Set<string>();

  pushCatalogAssetUrl(urls, library.original_image_url);
  pushCatalogAssetUrl(urls, library.processed_image_url);

  const specs = library.specs;
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    pushCatalogAssetUrl(urls, (specs as { legacy_image_url?: string }).legacy_image_url);
  }

  const cropConfig = library.crop_config;
  if (cropConfig && typeof cropConfig === "object" && !Array.isArray(cropConfig)) {
    const crop = cropConfig as {
      originalUrl?: string;
      processedUrl?: string;
      deliveryUrls?: { avif?: string; webp?: string; png?: string };
    };
    pushCatalogAssetUrl(urls, crop.originalUrl);
    pushCatalogAssetUrl(urls, crop.processedUrl);
    pushCatalogDeliveryUrls(urls, crop.deliveryUrls);
  }

  for (const row of sizeRows) {
    pushCatalogAssetUrl(urls, row.normalized_processed_image_url);
    pushCatalogDeliveryUrls(
      urls,
      row.normalized_delivery_urls as { avif?: string; webp?: string; png?: string } | null,
    );
  }

  return [...urls];
}

export async function deleteBeadLibraryAssetUrls(publicUrls: string[]): Promise<void> {
  await deleteCatalogAssetUrls(publicUrls);
}
