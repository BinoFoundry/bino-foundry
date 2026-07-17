import { isLensClipConfigValid, type LensClipConfig } from "@bino-foundry/shared/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import type { MaskConfig } from "@/render/mask/mask-types";
import { isMaskConfigValid } from "@/render/mask/mask-types";
import { viewRequiresLensClip } from "@/render/frame-plate/crop";

import { maskConfigToLensClipConfig } from "./mask-to-clip";

export function resolveLensClipConfig(view: {
  clipConfig?: LensClipConfig | null;
  maskConfig?: MaskConfig | null;
  width?: number;
  height?: number;
}): LensClipConfig | null {
  if (view.clipConfig && isLensClipConfigValid(view.clipConfig)) {
    return view.clipConfig;
  }
  if (view.maskConfig && isMaskConfigValid(view.maskConfig)) {
    return maskConfigToLensClipConfig(view.maskConfig, {
      render: view.clipConfig?.render,
      existingClip: view.clipConfig,
    });
  }
  return null;
}

export function isFrameViewClipReady(view: FrameRenderView): boolean {
  if (!view.plateUrl?.trim()) return false;
  if (!viewRequiresLensClip(view)) return true;
  if (view.clipStatus === "ready" && resolveLensClipConfig(view)) return true;
  return Boolean(resolveLensClipConfig(view));
}
