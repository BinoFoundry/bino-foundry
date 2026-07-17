import {
  createLensClipConfig,
  normalizeLensClipConfig,
  type LensClipConfig,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";
import type { MaskConfig } from "@/render/mask/mask-types";
import { migrateAnchors, type LensPolygon } from "@/render/mask/mask-types";

import { lensesToClipShapes } from "./svg-path-builder";

export type MaskToClipPreserve = {
  render?: LensClipRenderSettings;
  existingClip?: LensClipConfig | null;
};

function preserveExclusionsFromExistingClip(
  shapes: ReturnType<typeof lensesToClipShapes>,
  existingClip?: LensClipConfig | null,
) {
  if (!existingClip) return shapes;
  return shapes.map((shape) => {
    if (shape.exclusions?.length) return shape;
    const existing = existingClip.lenses.find((lens) => lens.id === shape.id);
    if (!existing?.exclusions?.length) return shape;
    return { ...shape, exclusions: existing.exclusions };
  });
}

/** Convert MaskConfig v2 (editor anchors) → LensClipConfig v1 (SVG paths). */
export function maskConfigToLensClipConfig(
  mask: MaskConfig,
  preserve?: MaskToClipPreserve | null,
): LensClipConfig {
  const lenses = (mask.lenses ?? []).map((l) => ({
    ...l,
    points: migrateAnchors(l.points),
  })) as LensPolygon[];

  const shapes = preserveExclusionsFromExistingClip(
    lensesToClipShapes(lenses, mask.imageWidth, mask.imageHeight, mask.exclusions),
    preserve?.existingClip,
  );

  return normalizeLensClipConfig(
    createLensClipConfig(mask.imageWidth, mask.imageHeight, shapes, preserve?.render),
  );
}
