import { buildLayersFromSource } from '../autoLensMask.js';
import { loadImage } from '../lensCompositor.js';
import { pathsToMaskCanvas } from './bezierPath.js';

/**
 * Apply stored polygon mask config to the layered rendering pipeline.
 * Original asset is never modified — mask is generated at runtime.
 *
 * @param {HTMLImageElement} sourceImage
 * @param {import('./types.js').MaskConfig} maskConfig
 */
export async function applyPolygonMaskToAsset(sourceImage, maskConfig) {
  // Anchors are normalized (0–1); rasterize at the loaded image size so preview matches the editor.
  const w = sourceImage.naturalWidth || sourceImage.width;
  const h = sourceImage.naturalHeight || sourceImage.height;
  const maskCanvas = pathsToMaskCanvas(w, h, maskConfig.lenses);
  const { backCanvas, frameCanvas } = buildLayersFromSource(sourceImage, maskCanvas);

  const toImage = (canvas) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL('image/png');
    });

  const [frameImage, backImage] = await Promise.all([
    toImage(frameCanvas),
    toImage(backCanvas),
  ]);

  return { maskCanvas, frameImage, backImage, sourceImage };
}

export async function loadAssetForRendering(asset) {
  const sourceImage = await loadImage(asset.sourceDataUrl);
  if (!asset.maskConfig) {
    return { sourceImage, maskCanvas: null, frameImage: null, backImage: null };
  }
  return applyPolygonMaskToAsset(sourceImage, asset.maskConfig);
}
