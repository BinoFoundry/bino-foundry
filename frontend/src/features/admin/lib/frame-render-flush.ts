import { isBeadCropConfigValid, isLensClipConfigValid, type BeadCropConfig } from "@bino-foundry/shared/types";

import { maskConfigToLensClipConfig } from "@/render/lens-clip";
import {
  effectivePlateDimensions,
  resolveOriginalPlate,
} from "@/render/frame-plate/crop";
import {
  hasAnyLensMask,
  isDualLensMaskValid,
  isMaskConfigValid,
  type MaskConfig,
} from "@/render/mask";
import type { FrameRenderView, FrameViewAxis } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";

export function mergeCropIntoView(view: FrameRenderView, config: BeadCropConfig): FrameRenderView {
  const original = resolveOriginalPlate(view);
  const dims = effectivePlateDimensions({ ...view, plateCropConfig: config });
  return {
    ...view,
    plateCropConfig: config,
    plateUrl: original.url || view.plateUrl,
    width: dims.width,
    height: dims.height,
    originalPlateUrl: original.url,
    originalWidth: original.width,
    originalHeight: original.height,
  };
}

export function mergeMaskIntoView(view: FrameRenderView, mask: MaskConfig): FrameRenderView {
  const clipConfig = maskConfigToLensClipConfig(mask);
  const clipReadyNow = Boolean(clipConfig && isLensClipConfigValid(clipConfig));
  return {
    ...view,
    maskConfig: mask,
    maskStatus: isDualLensMaskValid(mask) ? "ready" : "draft",
    clipConfig,
    clipStatus: clipReadyNow && isDualLensMaskValid(mask) ? "ready" : "draft",
  };
}

export type PendingFrameEdits = {
  cropByAxis?: Partial<Record<FrameViewAxis, BeadCropConfig | null>>;
  maskByAxis?: Partial<Record<FrameViewAxis, MaskConfig | null>>;
};

/** Merge in-progress editor drafts into render views before Save frame. */
export function flushFrameRenderViews(
  views: FrameRenderView[],
  pending: PendingFrameEdits,
): FrameRenderView[] {
  return FRAME_VIEW_AXES.map((axis) => {
    let view =
      views.find((v) => v.view === axis) ??
      ({
        view: axis,
        plateUrl: "",
        width: 0,
        height: 0,
        clipConfig: null,
        clipStatus: "draft",
        maskConfig: null,
        maskStatus: "draft",
      } satisfies FrameRenderView);

    const crop = pending.cropByAxis?.[axis];
    if (crop && isBeadCropConfigValid(crop)) {
      view = mergeCropIntoView(view, crop);
    }

    const mask = pending.maskByAxis?.[axis];
    if (mask && isMaskConfigValid(mask) && hasAnyLensMask(mask)) {
      view = mergeMaskIntoView(view, mask);
    }

    return view;
  });
}
