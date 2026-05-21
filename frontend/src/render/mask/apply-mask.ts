import { buildLayersFromSource } from "./auto-lens-mask";
import { loadImage } from "../engine/canvas/lens-compositor";
import { pathsToMaskCanvas } from "./bezier-path";
import type { MaskConfig } from "./mask-types";

export interface MaskedAssetLayers {
  maskCanvas: HTMLCanvasElement;
  frameImage: HTMLImageElement;
  backImage: HTMLImageElement;
  sourceImage: HTMLImageElement;
}

/**
 * Apply stored polygon mask config to the layered rendering pipeline.
 * Source image is never modified — mask is rasterized at runtime.
 */
export async function applyPolygonMaskToAsset(
  sourceImage: HTMLImageElement,
  maskConfig: MaskConfig,
): Promise<MaskedAssetLayers> {
  const w = sourceImage.naturalWidth || sourceImage.width;
  const h = sourceImage.naturalHeight || sourceImage.height;
  const maskCanvas = pathsToMaskCanvas(w, h, maskConfig.lenses);
  const { backCanvas, frameCanvas } = buildLayersFromSource(sourceImage, maskCanvas);

  const toImage = (canvas: HTMLCanvasElement) =>
    new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL("image/png");
    });

  const [frameImage, backImage] = await Promise.all([toImage(frameCanvas), toImage(backCanvas)]);

  return { maskCanvas, frameImage, backImage, sourceImage };
}

export interface RenderablePlateAsset {
  sourceUrl: string;
  maskConfig: MaskConfig | null;
  width: number;
  height: number;
}

export async function loadPlateForRendering(asset: RenderablePlateAsset) {
  const sourceImage = await loadImage(asset.sourceUrl);
  if (!asset.maskConfig) {
    return {
      sourceImage,
      maskCanvas: null as HTMLCanvasElement | null,
      frameImage: null as HTMLImageElement | null,
      backImage: null as HTMLImageElement | null,
    };
  }
  return applyPolygonMaskToAsset(sourceImage, asset.maskConfig);
}
