import { createCanvas } from "../engine/canvas/lens-compositor";

const DEFAULTS = {
  bgLumMin: 247,
  /** Only near-pure black is frame; dark grey lenses stay tintable. */
  frameLumMax: 26,
  lensLumMin: 20,
  lensLumMax: 252,
  satMax: 65,
  labelBandRatio: 0.11,
  colorGrowDist: 72,
  closeRadius: 4,
  openRadius: 2,
  featherPx: 1,
  frameHoleExpand: 2,
  frameRimDilate: 3,
  /** Pixels at or below this luminance are always frame (never tinted). */
  frameProtectLum: 44,
  /** Shrink lens mask away from frame acetate. */
  frameProtectDilate: 6,
  lensInsetErode: 2,
};

function lum(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function sat(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

function distRgb(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getImageDataFromSource(source) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  return { data: ctx.getImageData(0, 0, w, h), width: w, height: h };
}

function getFrameBBox(data, width, height, opts) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  const labelY = height * (1 - opts.labelBandRatio);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y >= labelY) continue;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      if (l >= opts.bgLumMin) continue;
      if (l <= opts.frameLumMax) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!found) return { x: 0, y: 0, w: width, h: height };

  const padX = Math.round((maxX - minX) * 0.02);
  const padY = Math.round((maxY - minY) * 0.03);
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    w: Math.min(width, maxX - minX + 1 + padX * 2),
    h: Math.min(height, maxY - minY + 1 + padY * 2),
  };
}

function inBox(x, y, box) {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

function classifyPixels({ data, width, height }, opts) {
  const n = width * height;
  const lens = new Uint8Array(n);
  const frameCore = new Uint8Array(n);
  const box = getFrameBBox(data, width, height, opts);
  const labelY = height * (1 - opts.labelBandRatio);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      const s = sat(r, g, b);

      if (y >= labelY && l > 130 && l < 240 && s < opts.satMax) continue;
      if (l >= opts.bgLumMin) continue;
      if (!inBox(x, y, box)) continue;

      if (l <= opts.frameLumMax && s <= opts.satMax) {
        frameCore[idx] = 1;
      } else if (l >= opts.lensLumMin && l <= opts.lensLumMax && s <= opts.satMax + 10) {
        lens[idx] = 1;
      }
    }
  }

  const frame = dilate(frameCore, width, height, opts.frameRimDilate);
  for (let idx = 0; idx < n; idx++) {
    if (frame[idx]) lens[idx] = 0;
  }

  return { lens, frame: frameCore, box };
}

function estimateBackgroundLum(data, width, height) {
  const samples = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
  ];
  let sum = 0;
  let count = 0;
  for (const [x, y] of samples) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = (y * width + x) * 4;
    sum += lum(data[i], data[i + 1], data[i + 2]);
    count += 1;
  }
  return count ? sum / count : DEFAULTS.bgLumMin;
}

/** Flood-fill lens from multiple left/right seeds to survive atypical shapes. */
function seedFillLenses(data, width, height, lens, frame, box, opts) {
  const xs = [0.22, 0.34, 0.42, 0.58, 0.66, 0.78];
  const ys = [0.42, 0.52, 0.62];
  const seeds = [];
  for (const fx of xs) {
    for (const fy of ys) {
      seeds.push([box.x + box.w * fx, box.y + box.h * fy]);
    }
  }
  const n = width * height;
  const visited = new Uint8Array(n);
  const rim = dilate(frame, width, height, opts.frameRimDilate);

  for (const [sx, sy] of seeds) {
    const stack = [[Math.round(sx), Math.round(sy)]];
    let ref = null;

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = y * width + x;
      if (visited[idx] || rim[idx]) continue;
      if (!inBox(x, y, box)) continue;

      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      if (l >= opts.bgLumMin) continue;
      if (l <= opts.frameProtectLum) continue;

      if (!ref) ref = { r, g, b };
      if (distRgb(r, g, b, ref.r, ref.g, ref.b) > opts.colorGrowDist + 12) continue;

      visited[idx] = 1;
      lens[idx] = 1;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
}

/**
 * Clear a vertical bridge corridor when a single blob straddles left + right,
 * so left/right lenses do not remain merged across the nose bridge.
 */
export function splitMergedLensBridge(mask, width, height, bridgeRatio = 0.06) {
  const midX = Math.floor(width / 2);
  const halfBridge = Math.max(2, Math.round(width * bridgeRatio * 0.5));
  let leftHits = 0;
  let rightHits = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      if (x < midX - halfBridge) leftHits += 1;
      else if (x > midX + halfBridge) rightHits += 1;
    }
  }
  // Only carve when both halves already have substantial mass (likely one merged blob).
  const minSide = width * height * 0.004;
  if (leftHits < minSide || rightHits < minSide) return mask;

  const out = mask.slice();
  for (let y = 0; y < height; y++) {
    for (let x = midX - halfBridge; x <= midX + halfBridge; x++) {
      if (x < 0 || x >= width) continue;
      out[y * width + x] = 0;
    }
  }
  return out;
}

function countMaskPixels(mask) {
  let c = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) c++;
  return c;
}

/** Remove lens mask overlap with frame acetate and dark rim pixels. */
function constrainLensToInterior(lens, frameCore, data, width, height, opts) {
  const out = lens.slice();
  const frameGuard = dilate(frameCore, width, height, opts.frameProtectDilate);
  const n = width * height;

  for (let idx = 0; idx < n; idx++) {
    if (frameGuard[idx]) {
      out[idx] = 0;
      continue;
    }
    if (!out[idx]) continue;
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = lum(r, g, b);
    const s = sat(r, g, b);
    if (l <= opts.frameProtectLum) out[idx] = 0;
    else if (l < 52 && s < 28) out[idx] = 0;
  }

  return erode(out, width, height, opts.lensInsetErode);
}

function medianLensColor(data, width, lens) {
  const rs = [];
  const gs = [];
  const bs = [];
  const n = width * (data.length / 4 / width);
  for (let idx = 0; idx < lens.length; idx++) {
    if (!lens[idx]) continue;
    const i = idx * 4;
    const l = lum(data[i], data[i + 1], data[i + 2]);
    if (l < 22 || l > 140) continue;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  if (!rs.length) return { r: 58, g: 58, b: 62 };
  const mid = (arr) => {
    arr.sort((a, b) => a - b);
    return arr[(arr.length / 2) | 0];
  };
  return { r: mid(rs), g: mid(gs), b: mid(bs) };
}

function growLensByColor(data, width, height, lens, frame, box, opts) {
  const ref = medianLensColor(data, width, lens);
  const n = width * height;
  const grown = new Uint8Array(lens);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (grown[idx] || frame[idx]) continue;
      if (!inBox(x, y, box)) continue;
      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      if (l >= opts.bgLumMin) continue;
      if (l <= opts.frameProtectLum) continue;
      if (l <= opts.frameLumMax && sat(r, g, b) <= opts.satMax) continue;
      if (distRgb(r, g, b, ref.r, ref.g, ref.b) <= opts.colorGrowDist) {
        grown[idx] = 1;
      }
    }
  }
  return grown;
}

function dilate(mask, width, height, radius) {
  if (radius < 1) return mask.slice();
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function erode(mask, width, height, radius) {
  if (radius < 1) return mask.slice();
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[idx] = 1;
    }
  }
  return out;
}

function morphCloseOpen(mask, width, height, closeR, openR) {
  let m = mask;
  if (closeR > 0) m = erode(dilate(m, width, height, closeR), width, height, closeR);
  if (openR > 0) m = dilate(erode(m, width, height, openR), width, height, openR);
  return m;
}

function keepLargestComponents(mask, width, height, keep = 2) {
  const labels = new Int32Array(mask.length);
  const sizes = [];
  let next = 1;

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx] || labels[idx]) continue;
    const stack = [idx];
    labels[idx] = next;
    let size = 0;
    while (stack.length) {
      const cur = stack.pop();
      size++;
      const x = cur % width;
      const y = (cur / width) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || labels[ni]) continue;
        labels[ni] = next;
        stack.push(ni);
      }
    }
    sizes.push({ id: next, size });
    next++;
  }

  sizes.sort((a, b) => b.size - a.size);
  const keepIds = new Set(sizes.slice(0, keep).map((s) => s.id));
  const out = new Uint8Array(mask.length);
  for (let idx = 0; idx < mask.length; idx++) {
    if (labels[idx] && keepIds.has(labels[idx])) out[idx] = 1;
  }
  return out;
}

function maskToCanvas(mask, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const d = imageData.data;
  for (let idx = 0; idx < mask.length; idx++) {
    const v = mask[idx] ? 255 : 0;
    const i = idx * 4;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  if (DEFAULTS.featherPx > 0) {
    const blurred = createCanvas(width, height);
    const bctx = blurred.getContext('2d');
    bctx.filter = `blur(${DEFAULTS.featherPx}px)`;
    bctx.drawImage(canvas, 0, 0);
    bctx.filter = 'none';
    return blurred;
  }
  return canvas;
}

/**
 * Flood from image borders through passable pixels (mask[idx] === 1 means wall).
 * Returns visited exterior/background regions.
 */
export function floodFromBorderThroughOpen(
  wall: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const exterior = new Uint8Array(wall.length);
  const stack = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (exterior[idx] || wall[idx]) return;
    exterior[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (stack.length) {
    const cur = stack.pop();
    const x = cur % width;
    const y = (cur / width) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  return exterior;
}

/**
 * Enclosed apertures: regions not reachable from the border when dark frame is a wall.
 * These are the lens openings (and similar enclosed cavities), never the outer silhouette.
 */
function findEnclosedApertures(frameWall, width, height) {
  const exterior = floodFromBorderThroughOpen(frameWall, width, height);
  const aperture = new Uint8Array(frameWall.length);
  for (let idx = 0; idx < aperture.length; idx++) {
    if (!exterior[idx] && !frameWall[idx]) aperture[idx] = 1;
  }
  return aperture;
}

function componentTouchesBorder(labels, componentId, width, height) {
  for (let x = 0; x < width; x++) {
    if (labels[x] === componentId || labels[(height - 1) * width + x] === componentId) return true;
  }
  for (let y = 0; y < height; y++) {
    if (labels[y * width] === componentId || labels[y * width + (width - 1)] === componentId) {
      return true;
    }
  }
  return false;
}

function labelComponentsDetailed(mask, width, height) {
  const labels = new Int32Array(mask.length);
  const components = [];
  let next = 1;

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx] || labels[idx]) continue;
    const stack = [idx];
    labels[idx] = next;
    let size = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length) {
      const cur = stack.pop();
      size += 1;
      const x = cur % width;
      const y = (cur / width) | 0;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || labels[ni]) continue;
        labels[ni] = next;
        stack.push(ni);
      }
    }

    components.push({
      id: next,
      size,
      centroidX: sumX / size,
      centroidY: sumY / size,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      touchesBorder: componentTouchesBorder(labels, next, width, height),
    });
    next += 1;
  }

  return { labels, components };
}

function buildFrameWall(data, width, height, opts) {
  const frameCore = new Uint8Array(width * height);
  const labelY = height * (1 - opts.labelBandRatio);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y >= labelY) continue;
      const idx = y * width + x;
      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue;
      const l = lum(r, g, b);
      const s = sat(r, g, b);
      if (l <= opts.frameProtectLum && s <= opts.satMax + 25) {
        frameCore[idx] = 1;
      } else if (l <= opts.frameLumMax + 18 && s <= opts.satMax + 15) {
        frameCore[idx] = 1;
      }
    }
  }

  const sealed = morphCloseOpen(frameCore, width, height, 3, 1);
  return dilate(sealed, width, height, 1);
}

function scoreLensAperture(meta, width, height) {
  const area = meta.size / (width * height);
  // Strongly down-rank outer silhouette / full body, but do not hard-ban until extreme.
  if (area > 0.45) return -1;
  if (area < 0.002) return -1;

  const aspect = meta.width / Math.max(1, meta.height);
  if (aspect < 0.25 || aspect > 4.5) return 0.05;

  const bboxArea = Math.max(1, meta.width * meta.height);
  const fillRatio = meta.size / bboxArea;
  // Near-solid AABBs spanning lots of the plate are usually frame cavities / silhouettes.
  if (area > 0.22 && fillRatio > 0.94) return 0.04;

  const cyNorm = meta.centroidY / height;
  const sizeScore =
    area >= 0.008 && area <= 0.14
      ? 1
      : area < 0.008
        ? area / 0.008
        : Math.max(0.05, 1 - (area - 0.14) / 0.35);
  const aspectScore = aspect >= 0.6 && aspect <= 2.4 ? 1 : 0.45;
  const verticalScore = cyNorm >= 0.18 && cyNorm <= 0.82 ? 1 : 0.45;
  // Prefer organic openings (ellipse-like fill) over hard boxes.
  const shapeScore =
    fillRatio >= 0.58 && fillRatio <= 0.92
      ? 1
      : fillRatio > 0.92
        ? 0.35
        : Math.max(0.2, fillRatio / 0.58);
  return sizeScore * 0.4 + aspectScore * 0.2 + verticalScore * 0.2 + shapeScore * 0.2;
}

function selectLensOpeningMask(aperture, width, height, keep = 2) {
  const { labels, components } = labelComponentsDetailed(aperture, width, height);
  const interior = components.filter((c) => !c.touchesBorder);
  const scored = interior
    .map((c) => ({ ...c, score: scoreLensAperture(c, width, height) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.size - a.size);

  const chosen = [];
  for (const c of scored) {
    if (chosen.length >= keep) break;
    if (chosen.length === 1) {
      const first = chosen[0];
      const mid = width / 2;
      const firstLeft = first.centroidX < mid;
      const thisLeft = c.centroidX < mid;
      if (
        firstLeft === thisLeft &&
        scored.some((o) => (o.centroidX < mid) !== firstLeft && o.score > 0)
      ) {
        continue;
      }
    }
    chosen.push(c);
  }

  if (chosen.length < keep) {
    for (const c of scored) {
      if (chosen.some((x) => x.id === c.id)) continue;
      chosen.push(c);
      if (chosen.length >= keep) break;
    }
  }

  // Last resort: any interior blobs by size (still better than empty polygons).
  if (chosen.length < keep) {
    const bySize = [...interior].sort((a, b) => b.size - a.size);
    for (const c of bySize) {
      if (chosen.some((x) => x.id === c.id)) continue;
      chosen.push(c);
      if (chosen.length >= keep) break;
    }
  }

  // Prefer one opening per side when possible: keep the best on left and right by X.
  if (chosen.length >= 2) {
    chosen.sort((a, b) => a.centroidX - b.centroidX);
  }

  const keepIds = new Set(chosen.slice(0, keep).map((c) => c.id));
  const out = new Uint8Array(aperture.length);
  for (let idx = 0; idx < out.length; idx++) {
    if (keepIds.has(labels[idx])) out[idx] = 1;
  }
  return out;
}

function refineApertureWithLensSeeds(data, aperture, frameWall, width, height, box, opts) {
  const out = aperture.slice();
  const xs = [0.28, 0.36, 0.64, 0.72];
  const ys = [0.45, 0.55];
  const visited = new Uint8Array(width * height);

  for (const fx of xs) {
    for (const fy of ys) {
      const sx = Math.round(box.x + box.w * fx);
      const sy = Math.round(box.y + box.h * fy);
      const stack = [[sx, sy]];
      let ref = null;
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const idx = y * width + x;
        if (visited[idx] || frameWall[idx]) continue;
        if (!inBox(x, y, box)) continue;

        const i = idx * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = lum(r, g, b);
        if (l >= opts.bgLumMin) continue;
        if (l <= opts.frameProtectLum) continue;

        if (!ref) ref = { r, g, b };
        if (distRgb(r, g, b, ref.r, ref.g, ref.b) > opts.colorGrowDist + 20) continue;

        visited[idx] = 1;
        out[idx] = 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  }

  // Never paint the frame wall as lens.
  for (let idx = 0; idx < out.length; idx++) {
    if (frameWall[idx]) out[idx] = 0;
  }
  return out;
}

/**
 * Detect lens *openings* (enclosed cavities), never the outer sunglasses silhouette.
 * Returns a binary bitmap (1 = lens opening pixel).
 */
export function detectLensMaskBitmap(source, userOpts = {}) {
  const { data, width, height } = getImageDataFromSource(source);
  const adaptiveBg = estimateBackgroundLum(data, width, height);
  const opts = {
    ...DEFAULTS,
    bgLumMin: Math.min(DEFAULTS.bgLumMin, Math.max(220, adaptiveBg - 8)),
    ...userOpts,
  };

  const box = getFrameBBox(data, width, height, opts);
  const frameWall = buildFrameWall(data, width, height, opts);

  // Primary: enclosed apertures carved out by the frame ring.
  let apertures = findEnclosedApertures(frameWall, width, height);
  // Light morphology — heavy close operations square off lens openings into boxes.
  apertures = morphCloseOpen(apertures, width, height, 1, 1);

  // Seed-refine only within frame barriers so fill cannot jump onto the outer body.
  apertures = refineApertureWithLensSeeds(data, apertures, frameWall, width, height, box, opts);
  apertures = morphCloseOpen(apertures, width, height, 1, 1);

  // Bridge must never be part of either opening.
  apertures = splitMergedLensBridge(apertures, width, height, 0.055);
  apertures = selectLensOpeningMask(apertures, width, height, 2);

  // Safety: strip frame wall again and tiny specks.
  for (let idx = 0; idx < apertures.length; idx++) {
    if (frameWall[idx]) apertures[idx] = 0;
  }
  apertures = morphCloseOpen(apertures, width, height, 1, 0);
  apertures = selectLensOpeningMask(apertures, width, height, 2);

  return { bitmap: apertures, width, height };
}

/**
 * Detect lens areas from a product photo on white (full frame render).
 */
export function detectLensMask(source, userOpts = {}) {
  const { bitmap, width, height } = detectLensMaskBitmap(source, userOpts);
  return maskToCanvas(bitmap, width, height);
}

/** Pull bright specular streaks on lenses into the mask. */
function addLensHighlights(lens, data, width, height, box, opts) {
  const out = lens.slice();
  const dilated = dilate(lens, width, height, 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (out[idx] || !dilated[idx]) continue;
      if (!inBox(x, y, box)) continue;
      const i = idx * 4;
      const l = lum(data[i], data[i + 1], data[i + 2]);
      const s = sat(data[i], data[i + 1], data[i + 2]);
      if (l > 155 && l <= opts.bgLumMin - 8 && s < opts.satMax + 15 && l > opts.frameProtectLum) {
        out[idx] = 1;
      }
    }
  }
  return out;
}

export function buildLayersFromSource(source, maskCanvas, opts = {}) {
  const holeExpand = opts.frameHoleExpand ?? DEFAULTS.frameHoleExpand;
  const width = maskCanvas.width;
  const height = maskCanvas.height;

  const backCanvas = createCanvas(width, height);
  const bctx = backCanvas.getContext('2d');
  bctx.drawImage(source, 0, 0);
  const wash = createCanvas(width, height);
  const wctx = wash.getContext('2d');
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(0, 0, width, height);
  wctx.globalCompositeOperation = 'destination-in';
  wctx.drawImage(maskCanvas, 0, 0);
  bctx.globalAlpha = 0.94;
  bctx.drawImage(wash, 0, 0);
  bctx.globalAlpha = 1;

  const frameCanvas = createCanvas(width, height);
  const fctx = frameCanvas.getContext('2d');
  fctx.drawImage(source, 0, 0);
  if (holeExpand > 0) {
    const expanded = createCanvas(width, height);
    const ectx = expanded.getContext('2d');
    ectx.filter = `blur(${holeExpand}px)`;
    ectx.drawImage(maskCanvas, 0, 0);
    ectx.filter = 'none';
    fctx.globalCompositeOperation = 'destination-out';
    fctx.drawImage(expanded, 0, 0);
  } else {
    fctx.globalCompositeOperation = 'destination-out';
    fctx.drawImage(maskCanvas, 0, 0);
  }
  fctx.globalCompositeOperation = 'source-over';

  return { backCanvas, frameCanvas };
}

export async function buildFromSourceImage(source, maskOpts) {
  const maskCanvas = detectLensMask(source, maskOpts);
  const { backCanvas, frameCanvas } = buildLayersFromSource(source, maskCanvas);

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

  return { maskCanvas, frameImage, backImage };
}
