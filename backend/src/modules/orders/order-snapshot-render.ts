import {
  beadLibraryInheritsTypeStrandDefaults,
  mergeStrandRenderProfile,
  parseBeadPlacementMode,
  parseStrandRenderProfile,
  partialStrandOverrideFromMetadata,
  resolveStrandRenderConfig,
  type BeadCropConfig,
  type BeadDeliveryUrls,
  type OrderSnapshotBeadItem,
  type OrderSnapshotBeadRender,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { settingsService } from "../settings/settings.service.js";

type LibraryRow = {
  id: string;
  public_id: string;
  name: string;
  bead_type_id: string | null;
  sub_bead_type_id: string | null;
  original_image_url: string | null;
  processed_image_url: string | null;
  crop_config: BeadCropConfig | null;
  metadata: Record<string, unknown> | null;
  bead_types: {
    id: string;
    slug: string;
    placement_mode?: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
  sub_bead_types: {
    id: string;
    slug: string;
    metadata: Record<string, unknown> | null;
  } | null;
};

type SizeOfferRow = {
  id: string;
  unit_price: number;
  normalization_factor: number | null;
  asset_visible_diameter_px: number | null;
  normalized_visible_diameter_px: number | null;
  normalized_processed_image_url: string | null;
  normalized_delivery_urls: BeadDeliveryUrls | null;
  bead_libraries: { public_id: string } | null;
  bead_sizes: {
    size_mm: number;
    label: string;
    group_reference_diameter_px: number | null;
  } | null;
};

function processedUrlFromCrop(cropConfig: unknown): string {
  if (!cropConfig || typeof cropConfig !== "object") return "";
  const url = (cropConfig as { processedUrl?: string }).processedUrl;
  return typeof url === "string" ? url.trim() : "";
}

function displayImages(lib: LibraryRow): {
  image: string;
  originalImage: string;
  processedImage: string;
} {
  const original = String(lib.original_image_url ?? "").trim();
  let processed = String(lib.processed_image_url ?? "").trim();
  if (processed && original && processed === original) processed = "";
  if (!processed) {
    processed = processedUrlFromCrop(lib.crop_config);
    if (processed && original && processed === original) processed = "";
  }
  return {
    image: processed || original,
    originalImage: original,
    processedImage: processed,
  };
}

function resolveProfileForLibrary(
  lib: LibraryRow,
  systemDefaults: StrandRenderProfile,
): StrandRenderProfile {
  const typeMeta = (lib.bead_types?.metadata ?? null) as Record<string, unknown> | null;
  const subMeta = (lib.sub_bead_types?.metadata ?? null) as Record<string, unknown> | null;
  const libMeta = (lib.metadata ?? null) as Record<string, unknown> | null;

  const resolved = resolveStrandRenderConfig({
    systemDefaults,
    beadTypeDefaults: {
      ...(parseStrandRenderProfile(typeMeta?.strandRender) ?? {}),
      placementMode: parseBeadPlacementMode(lib.bead_types?.placement_mode),
    },
    subBeadTypePartialOverride: partialStrandOverrideFromMetadata(subMeta),
    beadPartialOverride: partialStrandOverrideFromMetadata(libMeta),
  });

  const { provenance: _p, resolvedRenderScale: _s, imageSizeAdjust: _i, ...profile } = resolved;
  return mergeStrandRenderProfile(profile);
}

/**
 * Attach frozen visual/render payloads to order snapshot bead items so admin
 * replay does not depend on later catalogue changes.
 */
export async function enrichOrderSnapshotItemsWithRender(
  items: OrderSnapshotBeadItem[],
): Promise<{
  items: OrderSnapshotBeadItem[];
  strandRenderDefaults: StrandRenderProfile;
  hasRenderFreeze: boolean;
}> {
  const systemDefaults = await settingsService.getStrandRenderDefaults();
  const libraryIds = [...new Set(items.map((i) => i.beadLibraryId).filter(Boolean))];
  if (!libraryIds.length) {
    return { items, strandRenderDefaults: systemDefaults, hasRenderFreeze: false };
  }

  const supabase = getSupabaseServiceRole();
  const { data: libs, error: libErr } = await supabase
    .from("bead_libraries")
    .select(
      "id, public_id, name, bead_type_id, sub_bead_type_id, original_image_url, processed_image_url, crop_config, metadata, bead_types(id, slug, placement_mode, metadata), sub_bead_types(id, slug, metadata)",
    )
    .in("public_id", libraryIds);
  assertNoDbError(libErr);

  const libraryRows = (libs ?? []) as unknown as LibraryRow[];
  const libById = new Map(libraryRows.map((row) => [row.public_id, row] as const));
  const libraryUuids = libraryRows.map((row) => row.id);

  const offerByKey = new Map<string, SizeOfferRow>();
  if (libraryUuids.length) {
    const { data: sizeRows, error: sizeErr } = await supabase
      .from("bead_library_sizes")
      .select(
        "id, unit_price, normalization_factor, asset_visible_diameter_px, normalized_visible_diameter_px, normalized_processed_image_url, normalized_delivery_urls, bead_libraries!inner(public_id), bead_sizes(size_mm, label, group_reference_diameter_px)",
      )
      .in("bead_library_id", libraryUuids);
    assertNoDbError(sizeErr);

    for (const raw of (sizeRows ?? []) as unknown as SizeOfferRow[]) {
      const publicId = String(raw.bead_libraries?.public_id ?? "");
      const sizeMm = Number(raw.bead_sizes?.size_mm ?? 0);
      if (!publicId || !sizeMm) continue;
      offerByKey.set(`${publicId}:${sizeMm}`, raw);
    }
  }

  let hasRenderFreeze = false;
  const enriched = items.map((item) => {
    const lib = libById.get(item.beadLibraryId);
    if (!lib) return item;

    const offer = offerByKey.get(`${item.beadLibraryId}:${item.beadSizeMm}`);
    const images = displayImages(lib);
    const profile = resolveProfileForLibrary(lib, systemDefaults);
    const offerKey = `${item.beadLibraryId}-${item.beadSizeMm}`;

    const render: OrderSnapshotBeadRender = {
      offerKey,
      image: images.image,
      originalImage: images.originalImage,
      processedImage: images.processedImage,
      beadTypeId: lib.bead_type_id ?? lib.bead_types?.id ?? undefined,
      beadTypeSlug: lib.bead_types?.slug ?? item.beadTypeSlug,
      subBeadTypeId: lib.sub_bead_type_id ?? lib.sub_bead_types?.id ?? undefined,
      subBeadTypeSlug: lib.sub_bead_types?.slug ?? undefined,
      cropConfig: lib.crop_config ?? null,
      metadata: lib.metadata ?? {},
      normalizationFactor:
        offer?.normalization_factor != null && Number(offer.normalization_factor) > 0
          ? Number(offer.normalization_factor)
          : 1,
      assetVisibleDiameterPx:
        offer?.asset_visible_diameter_px != null && Number(offer.asset_visible_diameter_px) > 0
          ? Number(offer.asset_visible_diameter_px)
          : null,
      groupReferenceDiameterPx:
        offer?.bead_sizes?.group_reference_diameter_px != null &&
        Number(offer.bead_sizes.group_reference_diameter_px) > 0
          ? Number(offer.bead_sizes.group_reference_diameter_px)
          : null,
      normalizedProcessedImageUrl: offer?.normalized_processed_image_url?.trim() || undefined,
      normalizedDeliveryUrls: offer?.normalized_delivery_urls ?? null,
      normalizedVisibleDiameterPx:
        offer?.normalized_visible_diameter_px != null &&
        Number(offer.normalized_visible_diameter_px) > 0
          ? Number(offer.normalized_visible_diameter_px)
          : null,
      strandRenderProfile: profile,
    };

    hasRenderFreeze = true;
    return {
      ...item,
      offerKey,
      beadTypeSlug: render.beadTypeSlug ?? item.beadTypeSlug,
      render,
    };
  });

  return {
    items: enriched,
    strandRenderDefaults: systemDefaults,
    hasRenderFreeze,
  };
}
