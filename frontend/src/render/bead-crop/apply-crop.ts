import type { CSSProperties } from "react";
import {
  BEAD_CROP_CONFIG_V2,
  getBeadCropPoints,
  type BeadCropConfig,
  type BeadDeliveryUrls,
} from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadSizeEntry } from "@/types/bead-sizes";
import { resolveAssetImageUrl, type AssetImageVariant } from "@/lib/asset-image-url";

function cropConfigProcessedUrl(config: BeadCropConfig | null | undefined): string {
  if (!config || typeof config !== "object") return "";
  const url = "processedUrl" in config ? config.processedUrl : undefined;
  return typeof url === "string" ? url.trim() : "";
}

function deliveryUrlsFromConfig(config: BeadCropConfig | null | undefined): BeadDeliveryUrls | null {
  if (!config || config.version !== BEAD_CROP_CONFIG_V2) return null;
  const urls = config.deliveryUrls;
  if (!urls) return null;
  if (urls.avif?.trim() || urls.webp?.trim() || urls.png?.trim()) return urls;
  return null;
}

function resolveOriginalUrl(bead: BeadLibraryEntry): string {
  return bead.originalImage?.trim() || "";
}

/** True when we have a distinct cropped/exported asset (not the full original plate). */
export function hasDistinctProcessedAsset(bead: BeadLibraryEntry | null | undefined): boolean {
  if (!bead) return false;
  const original = resolveOriginalUrl(bead);
  const processed =
    bead.processedImage?.trim() || cropConfigProcessedUrl(bead.cropConfig);
  return Boolean(processed && (!original || processed !== original));
}

function resolveProcessedPngUrl(bead: BeadLibraryEntry): string {
  return (
    bead.processedImage?.trim() ||
    cropConfigProcessedUrl(bead.cropConfig) ||
    bead.image?.trim() ||
    ""
  );
}

/** Catalogue slice used to refresh placed-bead size offers at render time. */
export type StrandOfferCatalogueContext = {
  beadSizes?: BeadSizeEntry[];
  beadLibrarySizes?: BeadLibrarySizeOffer[];
};

export function catalogueGroupReferenceForOffer(
  offer: Pick<BeadLibrarySizeOffer, "sizeMm" | "groupReferenceDiameterPx"> | null | undefined,
  catalogue?: StrandOfferCatalogueContext,
): number | null {
  if (offer?.groupReferenceDiameterPx && offer.groupReferenceDiameterPx > 0) {
    return offer.groupReferenceDiameterPx;
  }
  const fromCat = catalogue?.beadSizes?.find((s) => s.sizeMm === offer?.sizeMm)
    ?.groupReferenceDiameterPx;
  return fromCat && fromCat > 0 ? fromCat : null;
}

/** Merge a placed size snapshot with fresh catalogue junction data (normalized URLs, group ref). */
export function mergeSizeOfferFromCatalogue(
  offer: BeadLibrarySizeOffer | undefined,
  catalogue: StrandOfferCatalogueContext | undefined,
  beadLibraryId?: string,
): BeadLibrarySizeOffer | undefined {
  if (!offer) return undefined;
  const fresh = catalogue?.beadLibrarySizes?.find(
    (o) =>
      (offer.offerKey && o.offerKey === offer.offerKey) ||
      (beadLibraryId && o.beadLibraryId === beadLibraryId && o.sizeMm === offer.sizeMm),
  );
  const merged = fresh ? { ...offer, ...fresh } : { ...offer };
  const groupRef = catalogueGroupReferenceForOffer(merged, catalogue);
  if (groupRef) {
    return { ...merged, groupReferenceDiameterPx: groupRef };
  }
  return merged;
}

/** True when a per-mm-group normalized export is available for the strand builder. */
export function hasPreNormalizedStrandAsset(
  offer: Pick<
    BeadLibrarySizeOffer,
    | "normalizedProcessedImageUrl"
    | "normalizedVisibleDiameterPx"
    | "groupReferenceDiameterPx"
  > | null | undefined,
  _catalogue?: StrandOfferCatalogueContext,
): boolean {
  if (!offer?.normalizedProcessedImageUrl?.trim()) return false;
  const baked = offer.normalizedVisibleDiameterPx;
  return baked != null && baked > 0;
}

export function resolvePreNormalizedDeliveryUrl(
  offer: Pick<
    BeadLibrarySizeOffer,
    | "normalizedProcessedImageUrl"
    | "normalizedDeliveryUrls"
    | "normalizedVisibleDiameterPx"
    | "groupReferenceDiameterPx"
  > | null | undefined,
  variant: AssetImageVariant = "medium",
  catalogue?: StrandOfferCatalogueContext,
): string | null {
  if (!hasPreNormalizedStrandAsset(offer, catalogue)) return null;

  const delivery = offer?.normalizedDeliveryUrls;
  const pick =
    delivery?.avif?.trim() ||
    delivery?.webp?.trim() ||
    delivery?.png?.trim() ||
    offer?.normalizedProcessedImageUrl?.trim() ||
    null;

  if (!pick) return null;
  return resolveAssetImageUrl(pick, variant) ?? pick;
}

/**
 * Builder-optimized delivery URL — prefers stored avif/webp, then processed PNG.
 * Admin editor should use original via getBeadDisplayImageUrl(..., full).
 */
export function resolveBeadDeliveryUrl(
  bead: BeadLibraryEntry | null | undefined,
  variant: AssetImageVariant = "medium",
): string | null {
  if (!bead) return null;

  const delivery = deliveryUrlsFromConfig(bead.cropConfig);
  const pick =
    delivery?.avif?.trim() ||
    delivery?.webp?.trim() ||
    delivery?.png?.trim() ||
    (hasDistinctProcessedAsset(bead) ? resolveProcessedPngUrl(bead) : null);

  if (pick) {
    return resolveAssetImageUrl(pick, variant) ?? pick;
  }

  return getBeadDisplayImageUrl(bead, variant);
}

/** URL shown on the bracelet strand (processed when available, else original for path clip). */
export function getBeadDisplayImageUrl(
  bead: BeadLibraryEntry | null | undefined,
  variant: AssetImageVariant = "full",
): string | null {
  if (!bead) return null;

  const original = resolveOriginalUrl(bead);
  const processed =
    bead.processedImage?.trim() || cropConfigProcessedUrl(bead.cropConfig) || "";

  if (processed && (!original || processed !== original)) {
    return variant === "full" ? processed : resolveAssetImageUrl(processed, variant) ?? processed;
  }

  if (original) {
    return variant === "full" ? original : resolveAssetImageUrl(original, variant) ?? original;
  }

  const legacy = bead.image?.trim();
  if (legacy) {
    return variant === "full" ? legacy : resolveAssetImageUrl(legacy, variant) ?? legacy;
  }

  return null;
}

/** Library grid / admin list thumbnail. */
export function getBeadLibraryImageUrl(bead: BeadLibraryEntry | null | undefined): string | null {
  return resolveAssetImageUrl(getBeadDisplayImageUrl(bead, "full"), "thumbnail");
}

/** Builder strand display — optimized delivery when available. */
export function getBeadStrandImageUrl(bead: BeadLibraryEntry | null | undefined): string | null {
  return resolveBeadDeliveryUrl(bead, "medium");
}

/** Variant-aware catalogue image URL. */
export function getBeadImageUrlForVariant(
  bead: BeadLibraryEntry | null | undefined,
  variant: AssetImageVariant,
): string | null {
  if (variant === "full") return getBeadDisplayImageUrl(bead, "full");
  return resolveBeadDeliveryUrl(bead, variant) ?? resolveAssetImageUrl(getBeadDisplayImageUrl(bead, "full"), variant);
}

/** CSS clip-path from v2 path (dynamic crop without processed asset). */
export function beadCropClipPathStyles(config: BeadCropConfig | null | undefined): {
  clipPath: string;
  WebkitClipPath: string;
} | undefined {
  if (!config || config.version !== BEAD_CROP_CONFIG_V2) return undefined;
  const points = getBeadCropPoints(config);
  if (points.length < 3) return undefined;
  const pairs = points.map((p) => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(", ");
  const path = `polygon(${pairs})`;
  return { clipPath: path, WebkitClipPath: path };
}

/** @deprecated v1 rect crop — CSS object-position fallback */
export function beadCropObjectStyles(config: BeadCropConfig | null | undefined): {
  objectPosition: string;
  objectFit: "cover";
} | undefined {
  if (!config || config.version !== BEAD_CROP_CONFIG_V2) {
    if (config?.version !== 1 || !("crop" in config) || !config.crop) return undefined;
    const { x, y, width, height } = config.crop;
    const px = ((x + width / 2) * 100).toFixed(2);
    const py = ((y + height / 2) * 100).toFixed(2);
    return { objectPosition: `${px}% ${py}%`, objectFit: "cover" };
  }
  return undefined;
}

/** Inline styles for strand bead image (processed asset or path clip on original). */
export function beadDisplayImageStyles(
  bead: BeadLibraryEntry | null | undefined,
): CSSProperties | undefined {
  if (!bead) return undefined;
  if (hasDistinctProcessedAsset(bead)) return undefined;
  const clip = beadCropClipPathStyles(bead.cropConfig);
  if (clip) return clip;
  return beadCropObjectStyles(bead.cropConfig);
}

/** @deprecated Strand no longer applies type-based border-radius; crops define shape. */
export function beadShapeClass(_slug?: string): string {
  return "";
}
