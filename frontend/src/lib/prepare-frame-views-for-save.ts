import { uploadApi } from "@/services/api/upload";
import { isBeadCropConfigValid } from "@bino-foundry/shared/types";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";

import {
  exportFramePlateFromCropConfig,
  hasPlateCropApplied,
  resolveOriginalPlate,
} from "@/render/frame-plate/crop";
import { finalizeGlassSheetSettings } from "@/features/admin/lib/glass-sheet-lifecycle";

function processedFileName(axis: string): string {
  return `frame-${axis}-${Date.now()}.png`;
}

/**
 * Export cropped plates and upload processed assets. Called only on Save frame.
 * Original URLs are preserved; plateUrl becomes the processed crop for compositing.
 * plateCropConfig is retained for lossless re-edit on reopen.
 * Also promotes any draft glass-sheet blob URLs in clipConfig.render.
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

    let nextView: FrameRenderView;
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
      nextView = {
        ...view,
        plateUrl: imageUrl,
        width: cropped.width,
        height: cropped.height,
        originalPlateUrl: sourceUrl,
        originalWidth: original.width,
        originalHeight: original.height,
        plateCropConfig: {
          ...config,
          originalUrl: sourceUrl,
          imageWidth: config.imageWidth || original.width,
          imageHeight: config.imageHeight || original.height,
          processedUrl: imageUrl,
          updatedAt: Date.now(),
        },
      };
    } else {
      nextView = {
        ...view,
        originalPlateUrl: view.originalPlateUrl?.trim() || sourceUrl,
        originalWidth: original.width,
        originalHeight: original.height,
      };
    }

    if (nextView.clipConfig?.render) {
      const persistedBefore =
        view.clipConfig?.render?.glassSheetUrl &&
        !view.clipConfig.render.glassSheetUrl.startsWith("blob:")
          ? view.clipConfig.render.glassSheetUrl
          : null;
      const render = await finalizeGlassSheetSettings(
        nextView.clipConfig.render,
        persistedBefore,
      );
      nextView = {
        ...nextView,
        clipConfig: {
          ...nextView.clipConfig,
          render,
          updatedAt: Date.now(),
        },
      };
    }

    prepared.push(nextView);
  }

  return prepared;
}
