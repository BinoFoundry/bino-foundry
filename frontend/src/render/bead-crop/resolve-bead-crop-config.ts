import type { BeadCropConfig, BeadCropPhysicalMetrics } from "@bino-foundry/shared/types";
import { BEAD_CROP_CONFIG_V2 } from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

function metricsFromMetadata(meta: Record<string, unknown> | undefined): BeadCropPhysicalMetrics | null {
  if (!meta) return null;
  const pm = meta.physicalMetrics ?? meta.strandPhysicalMetrics;
  if (!pm || typeof pm !== "object") return null;
  const m = pm as BeadCropPhysicalMetrics;
  const ref = m.referenceDiameterPx ?? m.visibleDiameterPx ?? Math.max(m.visibleWidthPx ?? 0, m.visibleHeightPx ?? 0);
  if (ref <= 0) return null;
  return m;
}

/** Read crop config from catalogue entry (camelCase, snake_case, or metadata backup). */
export function resolveBeadCropConfig(
  bead: BeadLibraryEntry | null | undefined,
): BeadCropConfig | null {
  if (!bead) return null;

  const direct = bead.cropConfig;
  if (direct?.imageWidth && direct.imageHeight) return direct;

  const snake = (bead as { crop_config?: BeadCropConfig }).crop_config;
  if (snake?.imageWidth && snake.imageHeight) return snake;

  const meta = bead.metadata as Record<string, unknown> | undefined;
  const fromMeta = meta?.cropConfig;
  if (fromMeta && typeof fromMeta === "object") {
    const cfg = fromMeta as BeadCropConfig;
    if (cfg.imageWidth && cfg.imageHeight) return cfg;
  }

  const pm = metricsFromMetadata(meta);
  if (pm && bead.processedImage) {
    const processedW = pm.processedWidthPx ?? pm.visibleWidthPx;
    const processedH = pm.processedHeightPx ?? pm.visibleHeightPx;
    return {
      version: BEAD_CROP_CONFIG_V2,
      imageWidth: processedW,
      imageHeight: processedH,
      originalUrl: bead.originalImage ?? bead.image,
      processedUrl: bead.processedImage,
      points: [],
      scale: 1,
      physicalMetrics: pm,
    };
  }

  return direct ?? snake ?? null;
}
