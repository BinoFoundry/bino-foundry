import { uploadApi } from "@/services/api/upload";
import { isBeadCropConfigValid } from "@bino-foundry/shared/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";

import {
  exportFramePlateFromCropConfig,
  hasPlateCropApplied,
  resolveOriginalPlate,
} from "@/render/frame-plate/crop";

function processedFileName(axis: string): string {
  return `frame-${axis}-${Date.now()}.png`;
}

/**
 * Export cropped plates and upload processed assets. Called only on Save frame.
 * Original URLs are preserved; plateUrl becomes the processed crop for compositing.
 */
export async function prepareRenderViewsForSave(views: FrameRenderView[]): Promise<FrameRenderView[]> {
  const prepared: FrameRenderView[] = [];

  for (const axis of FRAME_VIEW_AXES) {
    const view = views.find((v) => v.view === axis);
    if (!view?.plateUrl?.trim()) continue;

    const original = resolveOriginalPlate(view);
    const sourceUrl = original.url || view.plateUrl.trim();
    const config = view.plateCropConfig;
    const needsCropExport = hasPlateCropApplied(view) && config && isBeadCropConfigValid(config);

    if (needsCropExport) {
      const cropped = await exportFramePlateFromCropConfig({
        ...config,
        originalUrl: sourceUrl,
        imageWidth: config.imageWidth || original.width,
        imageHeight: config.imageHeight || original.height,
      });
      const { imageUrl } = await uploadApi.uploadImage(
        new File([cropped.blob], processedFileName(axis), { type: "image/png" }),
      );
      prepared.push({
        ...view,
        plateUrl: imageUrl,
        width: cropped.width,
        height: cropped.height,
        originalPlateUrl: sourceUrl,
        originalWidth: original.width,
        originalHeight: original.height,
        plateCropConfig: undefined,
      });
    } else {
      prepared.push({
        ...view,
        originalPlateUrl: view.originalPlateUrl?.trim() || sourceUrl,
        originalWidth: original.width,
        originalHeight: original.height,
        plateCropConfig: undefined,
      });
    }
  }

  return prepared;
}
