import { isLensClipConfigValid } from "@bino-foundry/shared/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import {
  createMaskConfig,
  isMaskConfigValid,
  resolveMaskFrameExclusions,
  type LensPolygon,
  type MaskConfig,
} from "@/render/mask/mask-types";

import { lensClipConfigToMaskConfig } from "./clip-to-mask";

/**
 * When the preferred mask has an outer Manual Detail but empty `holes`, and a fallback
 * mask (usually rebuilt from clip `holePathDs`) still has cutouts for the same id,
 * copy those cutouts across. Prefer preferred holes whenever they already exist so
 * editor deletes are not resurrected from stale clip data.
 */
export function enrichMaskHolesFromSource(
  preferred: MaskConfig,
  fallback: MaskConfig | null | undefined,
): MaskConfig {
  if (!fallback) return preferred;

  const preferredParts = resolveMaskFrameExclusions(preferred);
  const fallbackParts = resolveMaskFrameExclusions(fallback);
  if (!preferredParts.length) {
    if (!fallbackParts.length) return preferred;
    return createMaskConfig(
      preferred.imageWidth,
      preferred.imageHeight,
      preferred.lenses,
      preferred.exclusions,
      fallbackParts,
    );
  }

  const fallbackById = new Map(fallbackParts.map((part) => [part.id, part]));
  let changed = false;
  const merged: LensPolygon[] = preferredParts.map((part) => {
    const preferredHoles = part.holes ?? [];
    if (preferredHoles.length > 0) return part;
    const fallbackHoles = fallbackById.get(part.id)?.holes ?? [];
    if (!fallbackHoles.length) return part;
    changed = true;
    return { ...part, holes: fallbackHoles };
  });

  if (!changed) return preferred;
  return createMaskConfig(
    preferred.imageWidth,
    preferred.imageHeight,
    preferred.lenses,
    preferred.exclusions,
    merged,
  );
}

/**
 * Mask config for the polygon editor: prefer stored anchors, else rebuild from SVG clip paths.
 * When both exist, restore cutouts from clip if the stored mask lost empty `holes`.
 */
export function resolveMaskConfigForEditor(view: FrameRenderView): MaskConfig | null {
  const fromMask =
    view.maskConfig && isMaskConfigValid(view.maskConfig) ? view.maskConfig : null;
  const fromClip =
    view.clipConfig && isLensClipConfigValid(view.clipConfig)
      ? lensClipConfigToMaskConfig(view.clipConfig)
      : null;

  if (fromMask && fromClip) {
    return enrichMaskHolesFromSource(fromMask, fromClip);
  }

  return fromMask ?? fromClip;
}

/** Stable key for editor mount — must NOT include updatedAt (changes every edit tick). */
export function editorPlateKey(view: FrameRenderView): string {
  return `${view.view}|${view.plateUrl}|${view.width}x${view.height}`;
}
