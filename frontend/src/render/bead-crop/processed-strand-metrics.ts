import { detectContentBoundsFromRgba } from "@/render/image-bounds/content-bounds";
import type { BeadCropPhysicalMetrics } from "@bino-foundry/shared/types";
import { loadImage } from "./image-loader";

const cache = new Map<string, BeadCropPhysicalMetrics>();
const inflight = new Map<string, Promise<BeadCropPhysicalMetrics | null>>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function peekProcessedStrandMetrics(url: string | null | undefined): BeadCropPhysicalMetrics | null {
  if (!url) return null;
  return cache.get(url.trim()) ?? null;
}

/** Test/helper — seed measured alpha metrics as if the processed PNG had been scanned. */
export function seedProcessedStrandMetrics(
  url: string,
  metrics: BeadCropPhysicalMetrics,
): void {
  const key = url.trim();
  if (!key) return;
  cache.set(key, metrics);
  notify();
}

export function subscribeProcessedStrandMetrics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadProcessedStrandMetrics(
  url: string | null | undefined,
): Promise<BeadCropPhysicalMetrics | null> {
  const key = url?.trim();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit) return hit;

  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const img = await loadImage(key);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w <= 0 || h <= 0) return null;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      const bounds = detectContentBoundsFromRgba(data, w, h);
      if (!bounds) return null;

      const visibleWidthPx = bounds.width;
      const visibleHeightPx = bounds.height;
      const referenceDiameterPx = Math.max(visibleWidthPx, visibleHeightPx);
      const metrics: BeadCropPhysicalMetrics = {
        visibleWidthPx,
        visibleHeightPx,
        referenceDiameterPx,
        visibleDiameterPx: referenceDiameterPx,
        processedWidthPx: w,
        processedHeightPx: h,
        visibleOriginXPx: bounds.x,
        visibleOriginYPx: bounds.y,
        occupancyRatio:
          Math.max(w, h) > 0
            ? Math.min(1, Math.max(0.05, referenceDiameterPx / Math.max(w, h)))
            : undefined,
      };
      cache.set(key, metrics);
      notify();
      return metrics;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

export function clearProcessedStrandMetricsCache(): void {
  cache.clear();
  inflight.clear();
}
