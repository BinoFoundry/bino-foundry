import sharp from "sharp";

import {
  getBeadCropPoints,
  isBeadCropConfigValid,
  type BeadCropConfig,
  type BeadPathAnchor,
} from "@bino-foundry/shared/types";

type Norm = { x: number; y: number };

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, "") : "0";
}

function defaultHandles(a: BeadPathAnchor, b: BeadPathAnchor, w: number, h: number) {
  const ax = a.x * w;
  const ay = a.y * h;
  const bx = b.x * w;
  const by = b.y * h;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = (-dy / len) * len * 0.12;
  const perpY = (dx / len) * len * 0.12;
  return {
    out: { x: (ax + dx * 0.33 + perpX) / w, y: (ay + dy * 0.33 + perpY) / h },
    inn: { x: (bx - dx * 0.33 + perpX) / w, y: (by - dy * 0.33 + perpY) / h },
  };
}

/** Closed SVG path `d` from crop anchors (pixel space). */
export function cropAnchorsToPathD(
  points: BeadPathAnchor[],
  imageWidth: number,
  imageHeight: number,
): string {
  if (points.length < 3) return "";
  const w = imageWidth;
  const h = imageHeight;
  const parts: string[] = [`M ${fmt(points[0]!.x * w)} ${fmt(points[0]!.y * h)}`];

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (!a.curved) {
      parts.push(`L ${fmt(b.x * w)} ${fmt(b.y * h)}`);
      continue;
    }
    const defs = defaultHandles(a, b, w, h);
    const c1: Norm = a.handleOut ?? defs.out;
    const c2: Norm = b.handleIn ?? defs.inn;
    parts.push(
      `C ${fmt(c1.x * w)} ${fmt(c1.y * h)} ${fmt(c2.x * w)} ${fmt(c2.y * h)} ${fmt(b.x * w)} ${fmt(b.y * h)}`,
    );
  }
  parts.push("Z");
  return parts.join(" ");
}

/** Tight AABB of path anchors in pixel space (includes control points when curved). */
export function cropPathBoundsPx(
  points: BeadPathAnchor[],
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  if (points.length < 3 || !imageWidth || !imageHeight) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const consider = (nx: number, ny: number) => {
    const x = nx * imageWidth;
    const y = ny * imageHeight;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    consider(a.x, a.y);
    if (a.curved) {
      const defs = defaultHandles(a, b, imageWidth, imageHeight);
      const c1 = a.handleOut ?? defs.out;
      const c2 = b.handleIn ?? defs.inn;
      consider(c1.x, c1.y);
      consider(c2.x, c2.y);
    }
  }

  const pad = 2;
  const x = Math.max(0, Math.floor(minX) - pad);
  const y = Math.max(0, Math.floor(minY) - pad);
  const right = Math.min(imageWidth, Math.ceil(maxX) + pad);
  const bottom = Math.min(imageHeight, Math.ceil(maxY) + pad);
  const width = Math.max(1, right - x);
  const height = Math.max(1, bottom - y);
  return { x, y, width, height };
}

export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Source image HTTP ${res.status} for ${url}`);
  }
  const ab = await res.arrayBuffer();
  if (!ab.byteLength) throw new Error(`Empty image body for ${url}`);
  return Buffer.from(ab);
}

/**
 * Server-side equivalent of frontend `exportFramePlateFromCropConfig`:
 * path-clip the original, then extract tight transparent PNG bounds.
 */
export async function exportCroppedFramePng(
  config: BeadCropConfig,
  originalBytes: Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!isBeadCropConfigValid(config)) {
    throw new Error("Invalid plate crop config");
  }

  const meta = await sharp(originalBytes).metadata();
  const imageWidth = config.imageWidth || meta.width || 0;
  const imageHeight = config.imageHeight || meta.height || 0;
  if (!imageWidth || !imageHeight) {
    throw new Error("Could not resolve crop image dimensions");
  }

  const points = getBeadCropPoints(config);
  const pathD = cropAnchorsToPathD(points, imageWidth, imageHeight);
  if (!pathD) throw new Error("Crop path is empty");

  const bounds = cropPathBoundsPx(points, imageWidth, imageHeight);
  if (!bounds) throw new Error("Could not compute crop bounds");

  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">` +
      `<path d="${pathD}" fill="white"/></svg>`,
  );

  const masked = await sharp(originalBytes)
    .resize(imageWidth, imageHeight, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  const buffer = await sharp(masked)
    .extract({
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    .png()
    .toBuffer();

  return { buffer, width: bounds.width, height: bounds.height };
}
