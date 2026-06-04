import type { CSSProperties } from "react";
import {
  BEAD_CROP_CONFIG_V2,
  getBeadCropPoints,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

function cropConfigProcessedUrl(config: BeadCropConfig | null | undefined): string {
  if (!config || typeof config !== "object") return "";
  const url = "processedUrl" in config ? config.processedUrl : undefined;
  return typeof url === "string" ? url.trim() : "";
}

function resolveOriginalUrl(bead: BeadLibraryEntry): string {
  return bead.originalImage?.trim() || "";
}

/** True when we have a distinct cropped/exported asset (not the full original plate). */
export function hasDistinctProcessedAsset(bead: BeadLibraryEntry | null | undefined): boolean {
  if (!bead) return false;
  const original = resolveOriginalUrl(bead);
  const processed = bead.processedImage?.trim() || cropConfigProcessedUrl(bead.cropConfig);
  return Boolean(processed && (!original || processed !== original));
}

/** URL shown on the bracelet strand (processed PNG when available, else original for path clip). */
export function getBeadDisplayImageUrl(bead: BeadLibraryEntry | null | undefined): string | null {
  if (!bead) return null;

  const original = resolveOriginalUrl(bead);
  const processed =
    bead.processedImage?.trim() || cropConfigProcessedUrl(bead.cropConfig) || "";

  if (processed && (!original || processed !== original)) {
    return processed;
  }

  if (original) return original;

  const legacy = bead.image?.trim();
  if (legacy && (!original || legacy !== original)) return legacy;

  return legacy || null;
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
