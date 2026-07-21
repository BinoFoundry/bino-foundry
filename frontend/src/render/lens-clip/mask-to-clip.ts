import {
  createLensClipConfig,
  normalizeLensClipConfig,
  type LensClipConfig,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask/mask-types";
import {
  migrateAnchors,
  resolveMaskFrameExclusions,
  type LensPolygon,
} from "@/render/mask/mask-types";

import { exclusionPolygonsToShapes, lensesToClipShapes } from "./svg-path-builder";

export type MaskToClipPreserve = {
  render?: LensClipRenderSettings;
  existingClip?: LensClipConfig | null;
};

/**
 * Convert MaskConfig v2 (editor anchors) → LensClipConfig v1 (SVG paths).
 *
 * The mask is authoritative for frame exclusions — it always carries the current list (see
 * FrameMaskEditor, which threads exclusions through every edit), so callers that intend to
 * preserve exclusions must include them in the mask.
 */
export function maskConfigToLensClipConfig(
  mask: MaskConfig,
  preserve?: MaskToClipPreserve | null,
): LensClipConfig {
  const lenses = (mask.lenses ?? []).map((l) => ({
    ...l,
    points: migrateAnchors(l.points),
  })) as LensPolygon[];

  const shapes = lensesToClipShapes(lenses, mask.imageWidth, mask.imageHeight);
  const frameExclusions = exclusionPolygonsToShapes(
    resolveMaskFrameExclusions(mask),
    mask.imageWidth,
    mask.imageHeight,
  );

  const config = createLensClipConfig(
    mask.imageWidth,
    mask.imageHeight,
    shapes,
    preserve?.render,
  );

  return normalizeLensClipConfig(
    frameExclusions.length ? { ...config, frameExclusions } : config,
  );
}
