import {
  createLensClipConfig,
  type FrameExclusionShape,
  type LensClipConfig,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask/mask-types";
import { migrateAnchors, type LensPolygon } from "@/render/mask/mask-types";

import { lensesToClipShapes } from "./svg-path-builder";

export type MaskToClipPreserve = {
  render?: LensClipRenderSettings;
  frameExclusions?: FrameExclusionShape[];
};

/** Convert MaskConfig v2 (editor anchors) → LensClipConfig v1 (SVG paths). */
export function maskConfigToLensClipConfig(
  mask: MaskConfig,
  preserve?: MaskToClipPreserve | null,
): LensClipConfig {
  const lenses = (mask.lenses ?? []).map((l) => ({
    ...l,
    points: migrateAnchors(l.points),
  })) as LensPolygon[];

  return createLensClipConfig(
    mask.imageWidth,
    mask.imageHeight,
    lensesToClipShapes(lenses, mask.imageWidth, mask.imageHeight),
    preserve?.render,
    preserve?.frameExclusions,
  );
}
