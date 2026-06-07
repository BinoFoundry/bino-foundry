function parseHex(hex) {
  const raw = hex.replace(/^#/, '').trim();
  if (raw.length === 3) {
    const [r, g, b] = raw.split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }
  if (raw.length !== 6) return { r: 45, g: 45, b: 48 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Build a lens mask from placed ellipses (percent coords). */
export function buildMaskFromRegions(width, height, regions) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  for (const region of regions) {
    const cx = (region.x / 100) * width;
    const cy = (region.y / 100) * height;
    const rx = (region.w / 100) * width * 0.5;
    const ry = (region.h / 100) * height * 0.5;
    const rot = ((region.rotation ?? 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}

function applyLensTint(ctx, maskCanvas, color, opacity, effects) {
  const { width, height } = maskCanvas;
  const { r, g, b } = parseHex(color);

  const tint = createCanvas(width, height);
  const tctx = tint.getContext('2d');
  tctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  tctx.fillRect(0, 0, width, height);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(maskCanvas, 0, 0);

  const graded = createCanvas(width, height);
  const gctx = graded.getContext('2d');
  gctx.drawImage(tint, 0, 0);

  const topAlpha = effects.gradientTop;
  const bottomAlpha = effects.gradientBottom;
  const grad = gctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, `rgba(0, 0, 0, ${topAlpha})`);
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(0, 0, 0, ${bottomAlpha})`);
  gctx.globalCompositeOperation = 'multiply';
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, width, height);

  const highlight = createCanvas(width, height);
  const hctx = highlight.getContext('2d');
  const bandY = height * effects.highlightY;
  const bandH = height * effects.highlightHeight;
  const hGrad = hctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  hGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  hGrad.addColorStop(0.35, `rgba(255, 255, 255, ${effects.highlightStrength})`);
  hGrad.addColorStop(0.65, `rgba(255, 255, 255, ${effects.highlightStrength * 0.6})`);
  hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  hctx.fillStyle = hGrad;
  hctx.fillRect(0, bandY, width, bandH);
  hctx.globalCompositeOperation = 'destination-in';
  hctx.drawImage(maskCanvas, 0, 0);

  gctx.globalCompositeOperation = 'screen';
  gctx.drawImage(highlight, 0, 0);

  ctx.globalAlpha = 1;
  ctx.drawImage(graded, 0, 0);
}

function drawShadow(ctx, width, height, strength) {
  const shadow = createCanvas(width, height);
  const sctx = shadow.getContext('2d');
  const grad = sctx.createRadialGradient(
    width * 0.5,
    height * 0.92,
    0,
    width * 0.5,
    height * 0.92,
    width * 0.35,
  );
  grad.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, height * 0.75, width, height * 0.25);
  ctx.drawImage(shadow, 0, 0);
}

/**
 * Composite frame + optional back layer + tinted lenses.
 * @param {object} opts
 * @param {HTMLImageElement|null} opts.backLayer - visible through lenses (temples)
 * @param {HTMLImageElement} opts.frameLayer - PNG with transparent lens holes
 * @param {HTMLCanvasElement} opts.maskCanvas - white = lens area
 */
export function renderComposite(canvas, opts) {
  const {
    backLayer,
    frameLayer,
    maskCanvas,
    lensColor,
    lensOpacity,
    effects,
    shadowStrength,
    background = '#FFFFFF',
  } = opts;

  const width = frameLayer.naturalWidth || frameLayer.width;
  const height = frameLayer.naturalHeight || frameLayer.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (shadowStrength > 0) {
    drawShadow(ctx, width, height, shadowStrength);
  }

  if (backLayer) {
    ctx.drawImage(backLayer, 0, 0, width, height);
  }

  applyLensTint(ctx, maskCanvas, lensColor, lensOpacity, effects);
  ctx.drawImage(frameLayer, 0, 0, width, height);

  return canvas;
}

export async function imageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function maskFromFile(file, targetW, targetH) {
  const img = await imageFromFile(file);
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const alpha = data[i + 3] / 255;
    const v = Math.round(lum * alpha);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Recolor lens pixels in-place using auto mask (keeps glass highlights from photo).
 */
const FRAME_PROTECT_LUM = 44;

function pixelSat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isFramePixel(r, g, b) {
  const sl = r * 0.299 + g * 0.587 + b * 0.114;
  if (sl <= FRAME_PROTECT_LUM) return true;
  if (sl < 54 && pixelSat(r, g, b) < 28) return true;
  return false;
}

export function renderAutoRecolor(canvas, opts) {
  const {
    sourceImage,
    maskCanvas,
    lensColor,
    lensOpacity,
    effects,
    shadowStrength,
    background = '#FFFFFF',
    /** When true, tint only where mask is white (polygon editor masks). Skips auto frame detection. */
    maskOnly = false,
  } = opts;

  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (shadowStrength > 0) {
    drawShadow(ctx, width, height, shadowStrength);
  }

  const srcLayer = createCanvas(width, height);
  srcLayer.getContext('2d').drawImage(sourceImage, 0, 0);
  const src = srcLayer.getContext('2d').getImageData(0, 0, width, height).data;

  const maskLayer = createCanvas(width, height);
  maskLayer.getContext('2d').drawImage(maskCanvas, 0, 0, width, height);
  const maskData = maskLayer.getContext('2d').getImageData(0, 0, width, height).data;

  const out = ctx.createImageData(width, height);
  const o = out.data;
  const { r: tr, g: tg, b: tb } = parseHex(lensColor);
  const hiStrength = effects.highlightStrength ?? 0.35;

  for (let i = 0; i < src.length; i += 4) {
    const sr = src[i];
    const sg = src[i + 1];
    const sb = src[i + 2];

    const m = Math.max(maskData[i], maskData[i + 1], maskData[i + 2]) / 255;
    if (m < 0.04) {
      o[i] = sr;
      o[i + 1] = sg;
      o[i + 2] = sb;
      o[i + 3] = 255;
      continue;
    }

    if (!maskOnly && isFramePixel(sr, sg, sb)) {
      o[i] = sr;
      o[i + 1] = sg;
      o[i + 2] = sb;
      o[i + 3] = 255;
      continue;
    }

    const sl = Math.max(1, sr * 0.299 + sg * 0.587 + sb * 0.114);

    const y = ((i / 4) / width) | 0;
    const yNorm = y / height;
    const topShade = yNorm < 0.45 ? effects.gradientTop * (1 - yNorm / 0.45) : 0;
    const botShade = yNorm > 0.55 ? effects.gradientBottom * ((yNorm - 0.55) / 0.45) : 0;
    const shade = 1 - Math.min(0.35, topShade + botShade);

    const highlight = Math.min(1, Math.max(0, (sl - 95) / 90));
    const lumaScale = Math.min(1.15, Math.max(0.45, sl / 70));
    const tintW = Math.min(1, lensOpacity * m * shade * (0.75 + 0.25 * lumaScale));

    const trScaled = Math.min(255, tr * lumaScale);
    const tgScaled = Math.min(255, tg * lumaScale);
    const tbScaled = Math.min(255, tb * lumaScale);

    let nr = sr * (1 - tintW) + trScaled * tintW;
    let ng = sg * (1 - tintW) + tgScaled * tintW;
    let nb = sb * (1 - tintW) + tbScaled * tintW;

    const hi = highlight * hiStrength * m * 0.85;
    nr = nr * (1 - hi) + 255 * hi;
    ng = ng * (1 - hi) + 255 * hi;
    nb = nb * (1 - hi) + 255 * hi;

    o[i] = nr;
    o[i + 1] = ng;
    o[i + 2] = nb;
    o[i + 3] = 255;
  }

  ctx.putImageData(out, 0, 0);
  return canvas;
}

export { loadImage, parseHex, createCanvas };
