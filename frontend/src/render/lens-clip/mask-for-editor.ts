import { isLensClipConfigValid } from "@bino-foundry/shared/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import { isMaskConfigValid, type MaskConfig } from "@/render/mask/mask-types";

import { lensClipConfigToMaskConfig } from "./clip-to-mask";

/**
 * Mask config for the polygon editor: prefer stored anchors, else rebuild from SVG clip paths.
 */
export function resolveMaskConfigForEditor(view: FrameRenderView): MaskConfig | null {
  if (view.maskConfig && isMaskConfigValid(view.maskConfig)) {
    return view.maskConfig;
  }

  if (view.clipConfig && isLensClipConfigValid(view.clipConfig)) {
    return lensClipConfigToMaskConfig(view.clipConfig);
  }

  return null;
}

/** Stable key for editor mount — must NOT include updatedAt (changes every edit tick). */
export function editorPlateKey(view: FrameRenderView): string {
  return `${view.view}|${view.plateUrl}|${view.width}x${view.height}`;
}
