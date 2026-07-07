import {
  deleteCatalogAssetUrls,
  pushCatalogAssetUrl,
  pushCatalogDeliveryUrls,
} from "../catalog-lifecycle/catalog-asset-cleanup.js";

function collectRenderViewUrls(urls: Set<string>, view: Record<string, unknown>): void {
  pushCatalogAssetUrl(urls, view.plate_url);
  pushCatalogAssetUrl(urls, view.original_plate_url);

  const cropConfig = view.plate_crop_config;
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
}

export function collectFrameAssetUrls(
  frame: Record<string, unknown>,
  renderViews: Record<string, unknown>[] = [],
): string[] {
  const urls = new Set<string>();

  const marketing = frame.marketing_copy;
  if (marketing && typeof marketing === "object" && !Array.isArray(marketing)) {
    const mc = marketing as {
      legacy_frame_images?: unknown;
      gallery_urls?: unknown;
      render_views?: unknown;
    };
    for (const value of [mc.legacy_frame_images, mc.gallery_urls]) {
      if (Array.isArray(value)) {
        for (const item of value) pushCatalogAssetUrl(urls, item);
      }
    }
    if (Array.isArray(mc.render_views)) {
      for (const view of mc.render_views) {
        if (view && typeof view === "object") {
          const v = view as { plateUrl?: string; originalPlateUrl?: string };
          pushCatalogAssetUrl(urls, v.plateUrl);
          pushCatalogAssetUrl(urls, v.originalPlateUrl);
        }
      }
    }
  }

  for (const view of renderViews) {
    collectRenderViewUrls(urls, view);
  }

  return [...urls];
}

export async function deleteFrameAssetUrls(publicUrls: string[]): Promise<void> {
  await deleteCatalogAssetUrls(publicUrls);
}
