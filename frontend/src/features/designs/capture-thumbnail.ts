import { calculateBeadCount, type PlacedBead } from "@/lib/luxe-data";
import {
  autoMaskOptionsForView,
  renderMaskedViewToCanvas,
  tintParamsFromGradient,
} from "@/render/engine/canvas/canvas-render-pipeline";
import type { SunglassesCompositorConfig } from "@/render/types";

import { getCustomiserDisplayViews } from "@/features/sunglasses/utils/compositor-views";

const THUMB_SIZE = 240;

function hashColor(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 52%)`;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Lightweight bracelet ring preview for My Designs. */
export async function captureBraceletThumbnail(
  placedBeads: PlacedBead[],
  wristSizeCm: number,
): Promise<string | null> {
  if (placedBeads.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#faf9f7";
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const center = THUMB_SIZE / 2;
  const radius = THUMB_SIZE * 0.34;
  const slotCount = Math.max(
    placedBeads.length,
    calculateBeadCount(wristSizeCm, placedBeads[0]?.size.sizeMm ?? 8),
  );

  ctx.strokeStyle = "#ddd5c8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  const images = await Promise.all(
    placedBeads.map(async (bead) => ({
      bead,
      image: await loadImage(bead.bead.image),
    })),
  );

  for (const { bead, image } of images) {
    const angle = (bead.position / slotCount) * Math.PI * 2 - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const sizePx = Math.max(10, bead.size.sizeMm * 2.2);

    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, sizePx / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(image, x - sizePx / 2, y - sizePx / 2, sizePx, sizePx);
      ctx.restore();
    } else {
      ctx.fillStyle = hashColor(bead.bead.name);
      ctx.beginPath();
      ctx.arc(x, y, sizePx / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL("image/jpeg", 0.86);
}

/** Sunglasses compositor snapshot for saved design previews. */
export async function captureSunglassesThumbnail(
  config: SunglassesCompositorConfig,
): Promise<string | null> {
  const views = getCustomiserDisplayViews(config);
  const primary = views[0];
  const clipViews = config.clipViews ?? config.maskedViews;
  const plate = primary ? clipViews?.[primary.axis] : undefined;
  if (!primary || !plate?.plateUrl) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = primary.aspectRatio === "video" ? 180 : 200;

  try {
    await renderMaskedViewToCanvas(
      canvas,
      {
        plateUrl: plate.plateUrl,
        width: plate.width,
        height: plate.height,
        maskConfig: plate.maskConfig ?? null,
        autoMaskOptions: autoMaskOptionsForView(primary.axis),
      },
      tintParamsFromGradient(config.tint.top, config.tint.bottom, config.tint.opacity ?? 0.88),
    );
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}
