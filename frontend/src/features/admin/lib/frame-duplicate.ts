import type { FrameEntry } from "@/data/glasses";
import type { FrameRenderView } from "@/types/frame-rendering";
import type { MaskConfig } from "@/render/mask";
import { createMaskConfig, ensureFrameLensSet, resolveMaskFrameExclusions } from "@/render/mask";

/**
 * Build a create-form seed from an existing frame.
 * Reuses plate/clip URLs by reference (same as sharing CDN assets until deep-copy exists).
 */
export function buildFrameDuplicateSeed(source: FrameEntry): FrameEntry {
  const baseName = source.name?.trim() || "Frame";
  const copyName = /\(copy\)\s*$/i.test(baseName) ? `${baseName}` : `${baseName} (copy)`;

  return {
    id: "",
    name: copyName,
    price: source.price ?? 0,
    description: source.description ?? "",
    isActive: source.isActive !== false,
    availabilityStatusCode: source.availabilityStatusCode ?? "ACTIVE",
    displayOrder: source.displayOrder ?? 0,
    lensRenderPresetId: source.lensRenderPresetId ?? null,
    useLensRenderPreset: source.useLensRenderPreset !== false,
    modelFamily: source.modelFamily?.trim() || null,
    frameImages: source.frameImages ? [...source.frameImages] : undefined,
    lensColors: [],
    renderViews: (source.renderViews ?? []).map(stripViewIdentity),
  };
}

function stripViewIdentity(view: FrameRenderView): FrameRenderView {
  const { id: _id, ...rest } = view;
  return { ...rest };
}

/**
 * Copy normalized lens openings + Manual Details from front onto the side plate.
 * Point coordinates stay 0–1 normalized, so they transfer across different pixel sizes.
 * Does not copy crop or plate images — side must already have its own photo.
 */
export function copyFrontGeometryToSideMask(
  frontMask: MaskConfig | null | undefined,
  sideWidth: number,
  sideHeight: number,
): MaskConfig | null {
  if (!frontMask || !(sideWidth > 0) || !(sideHeight > 0)) return null;
  const lenses = ensureFrameLensSet(frontMask.lenses ?? []);
  const exclusions = resolveMaskFrameExclusions(frontMask).map((part, index) => ({
    ...part,
    id: part.id?.startsWith("side-") ? part.id : `side-${part.id || index}`,
    depth: part.depth ?? index,
    layerOrder: "front" as const,
  }));
  return createMaskConfig(sideWidth, sideHeight, lenses, undefined, exclusions);
}
