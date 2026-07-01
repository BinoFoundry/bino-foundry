import { useEffect, useState } from "react";

import { loadImage } from "@/render/bead-crop/image-loader";
import { createCanvas } from "@/render/engine/canvas/lens-compositor";

import {
  contentBoundsViewBox,
  detectContentBoundsFromRgba,
  fullPlateViewBox,
  type ImageContentBounds,
} from "./content-bounds";

const boundsCache = new Map<string, ImageContentBounds | null>();

function cacheKey(url: string, width: number, height: number): string {
  return `${url}|${width}|${height}`;
}

async function measurePlateBounds(
  url: string,
  sourceWidth: number,
  sourceHeight: number,
): Promise<ImageContentBounds | null> {
  const key = cacheKey(url, sourceWidth, sourceHeight);
  if (boundsCache.has(key)) return boundsCache.get(key) ?? null;

  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || sourceWidth;
    const h = img.naturalHeight || sourceHeight;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    const bounds = detectContentBoundsFromRgba(data, w, h, { paddingPx: 4 });
    boundsCache.set(key, bounds);
    return bounds;
  } catch {
    boundsCache.set(key, null);
    return null;
  }
}

export interface PlateContentBoundsResult {
  viewBox: string;
  bounds: ImageContentBounds | null;
  ready: boolean;
}

/** Trim excess transparent/light margins from a plate URL for preview framing. */
export function usePlateContentBounds(
  url: string | undefined,
  sourceWidth: number,
  sourceHeight: number,
): PlateContentBoundsResult {
  const [result, setResult] = useState<PlateContentBoundsResult>(() => ({
    viewBox: fullPlateViewBox(sourceWidth, sourceHeight),
    bounds: null,
    ready: !url,
  }));

  useEffect(() => {
    if (!url || sourceWidth <= 0 || sourceHeight <= 0) {
      setResult({
        viewBox: fullPlateViewBox(sourceWidth, sourceHeight),
        bounds: null,
        ready: true,
      });
      return;
    }

    let cancelled = false;
    setResult((prev) => ({ ...prev, ready: false }));

    void measurePlateBounds(url, sourceWidth, sourceHeight).then((bounds) => {
      if (cancelled) return;
      setResult({
        bounds,
        viewBox: bounds
          ? contentBoundsViewBox(bounds, sourceWidth, sourceHeight)
          : fullPlateViewBox(sourceWidth, sourceHeight),
        ready: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [url, sourceWidth, sourceHeight]);

  return result;
}
