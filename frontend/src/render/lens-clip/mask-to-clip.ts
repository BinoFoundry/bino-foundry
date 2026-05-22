import { createLensClipConfig, type LensClipConfig } from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask/mask-types";
import { migrateAnchors, type LensPolygon } from "@/render/mask/mask-types";

import { lensesToClipShapes } from "./svg-path-builder";

/** Convert legacy MaskConfig v2 (editor anchors) → LensClipConfig v1 (SVG paths). */
export function maskConfigToLensClipConfig(mask: MaskConfig): LensClipConfig {
  const lenses = (mask.lenses ?? []).map((l) => ({
    ...l,
    points: migrateAnchors(l.points),
  })) as LensPolygon[];

  return createLensClipConfig(mask.imageWidth, mask.imageHeight, lensesToClipShapes(lenses, mask.imageWidth, mask.imageHeight));
}
