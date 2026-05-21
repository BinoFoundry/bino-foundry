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

/** Flood-fill lens from typical left/right lens centers inside frame bbox. */
function seedFillLenses(data, width, height, lens, frame, box, opts) {
  const seeds = [
    [box.x + box.w * 0.34, box.y + box.h * 0.55],
    [box.x + box.w * 0.66, box.y + box.h * 0.55],
  ];
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
 * Detect lens areas from a product photo on white (full frame render).
 */
export function detectLensMask(source, userOpts = {}) {
  const opts = { ...DEFAULTS, ...userOpts };
  const { data, width, height } = getImageDataFromSource(source);
  const { lens, frame, box } = classifyPixels({ data, width, height }, opts);

  let grown = lens.slice();
  seedFillLenses(data, width, height, grown, frame, box, opts);
  grown = growLensByColor(data, width, height, grown, frame, box, opts);

  const minPixels = width * height * 0.015;
  if (countMaskPixels(grown) < minPixels) {
    const relaxed = { ...opts, frameLumMax: 22, colorGrowDist: 85 };
    const retry = classifyPixels({ data, width, height }, relaxed).lens;
    grown = retry.slice();
    seedFillLenses(data, width, height, grown, frame, box, relaxed);
    grown = growLensByColor(data, width, height, grown, frame, box, relaxed);
  }

  grown = morphCloseOpen(grown, width, height, opts.closeRadius, opts.openRadius);
  grown = keepLargestComponents(grown, width, height, 2);
  grown = addLensHighlights(grown, data, width, height, box, opts);
  grown = constrainLensToInterior(grown, frame, data, width, height, opts);
  grown = morphCloseOpen(grown, width, height, 1, 0);
  return maskToCanvas(grown, width, height);
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
