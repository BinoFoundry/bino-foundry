/**
 * Generate per-tint frame plates by recolouring the lens of the live product
 * photos — no manual retouching, no contact sheets.
 *
 *   node scripts/generate-tinted-plates.mjs [--frame pk002] [--tint 5A0000]
 *                                           [--views front,side] [--out <dir>]
 *                                           [--stats] [--dry]
 *
 * Everything needed is in the database: the full-resolution plate for every
 * frame and view, and the lens outlines drawn in admin. A lens is treated as an
 * absorbing filter — output = tint colour x transmittance — where the
 * transmittance is recovered from the photograph: veil removed, median pinned
 * so every frame lands at the same density, the spread shaped to match the
 * hand-retouched references (glossy for dark tints, flat for pale ones).
 *
 * The tint colour itself comes from scripts/tint-calibration.json where a
 * reference exists, because a hex is a swatch and a lens is glass with a
 * thickness; the hex stands where no reference exists.
 *
 * Six frames were photographed with dark lenses fitted, which barely record
 * what is behind the glass and whose hand-drawn outlines trace the frame rather
 * than the lens. For those, scripts/clear-lens/<slug>.png — the supplier's
 * catalogue page with clear lenses — supplies the lens shape and what shows
 * through it; see clearLensSource for how it is fitted to the plate.
 *
 * Gradient tints vary the colour along the gradient axis inside each lens's
 * bounding box, the way the SVG compositor's objectBoundingBox gradient does.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const outDir = flag("out", "tinted-plates");
const onlyTint = flag("tint");
const onlyFrame = flag("frame");
const SAT_KEEP = Number(flag("sat", "0.65"));
/**
 * Pixels of feathered inset applied to the lens polygon. The polygons were drawn
 * for the live renderer, which paints the frame back over the lens edge, so
 * several of them run a little under the frame's inner bevel. Baking the colour
 * into the plate has no such second pass, and without an inset the tint creeps
 * onto the frame — very visible on the tortoiseshell frames.
 */
const INSET = Number(flag("inset", "9"));
/** Views to generate. The builder shows customers the front only. */
const VIEWS = (flag("views", "front")).split(",").map((v) => v.trim()).filter(Boolean);
const dryRun = args.includes("--dry");
const statsMode = args.includes("--stats");

/** Where the recoloured lens sits, as a multiple of the target mid-tone. */
const RANGE_LO = 0.45;
const RANGE_HI = 1.85;
/** Bins used to measure the photograph's own shading along the gradient axis. */
const PROFILE_BINS = 24;
/**
 * Where transmittance starts to roll off, and the ceiling it approaches.
 *
 * The counterpart of the toe below. Removing the veil from a frame shot with a
 * dark lens expands its contrast by up to 2x, and with nothing above the
 * background to hold it that pushed the broad studio highlight up to a hard
 * ceiling: 17-22% of the lens on those six frames came out brighter than twice
 * its median, against 0.6-5.5% in the references, which reads as a white smear
 * across the glass. The four clear-lens frames need no expansion and were within
 * a point either way, so this only has to bound what the expansion produces.
 *
 * A soft shoulder rather than a clamp, so a specular stays a gradient instead of
 * flattening into a disc at the cap.
 *
 * The ceiling is also capped per tint at the point where the brightest channel
 * would reach 255, because past that the channel stops rising while the others
 * keep going and the colour slides towards white. That is what turned the tan
 * into cream: its measured colour is 255,223,152, so it has no headroom at all
 * and any brightening desaturates it. A dark tint like #2B2B2B sits at 69,73,74
 * and could take 3.4x before clipping, so it is unaffected.
 */
const SHOULDER = 1.0;
const MAX_TRANSMISSION = Number(flag("max", "1.55"));
/**
 * How much of the photograph's own shading a pale tint keeps, and the tint
 * luminance over which it falls off.
 *
 * A dark lens shows the shape of the light on its surface; a pale one mostly
 * shows what is behind it, and reads flatter. Measured against the references,
 * the four pale tints all want the same thing to within a few percent — 0.79,
 * 0.82, 0.82, 0.82 — while the dark ones scatter around 1.0 with no trend, so
 * only the pale end is adjusted and the dark tints are left exactly as they are.
 *
 * Applied around the median rather than around zero, so flattening changes the
 * shading without moving the density the calibration was fitted at.
 */
const FLATTEN_LO = 120;
const FLATTEN_HI = 200;
/**
 * How much of the spread above and below the mid-tone a pale tint keeps.
 *
 * These are wildly different, and one figure for both was the mistake. A pale
 * lens is mostly showing what is behind it, so above the mid-tone there is
 * nothing left to see: the reference green runs 177, 177, 178, 178, 180 from its
 * lower quartile all the way to its 99th percentile — one flat colour. Below it,
 * the temple arms still block light and sit at 0.64 of that level, which is a
 * long way down and must survive.
 *
 * Compressing both ends together gave a lens too bright at the top and too dark
 * at the bottom at the same time, which reads as a mirror finish rather than
 * glass. Dark tints keep both ends: the references show a near-black lens with
 * more surface structure than the generator was producing, not less.
 *
 * The upper figure is a target rather than a proportion, because a proportion
 * cannot hold across these frames. The six shot with dark lenses need their
 * contrast expanded to be seen through at all, which leaves the raw spread above
 * the mid-tone close to 2.0 — keeping even a tenth of that still lands well
 * clear of the mid-tone, where the frames needing no expansion sit right on it.
 * Solving for the compression that puts the 97th percentile on the target makes
 * every frame land in the same place whatever its exposure.
 */
const PALE_TOP = 1.02;
/**
 * Window, in pixels, of the median filter a pale tint applies to the lens.
 *
 * The plates are compressed photographs of dark lenses, and compression noise
 * that is invisible at that density does not stay invisible once it is
 * multiplied up. Measured inside PK002's lens the source carries 0.41 levels of
 * fine grain; the navy tint scales it down to 0.18 and the green and tan scale
 * it up to 0.45, which is where the blocking comes from — it is the photograph's
 * own artefacts, amplified, not anything the tint added.
 *
 * A pale lens is flat apart from the arms, so that grain carries no detail worth
 * keeping and can simply go. Blended in by paleness, so dark tints, which
 * suppress the grain on their own, are untouched.
 *
 * Smoothed only where the lens is flat. A plain blur takes the temple arms with
 * it and the lens reads as out of focus; a median leaves edges but turns the
 * field blotchy at any useful window. Keeping the smoothed value in flat areas
 * and the photograph's own where there is a real edge does both — the tint is
 * effectively rebuilt over the arms rather than laid across the grain.
 *
 * This only ever manages the symptom. The six frames photographed with dark
 * lenses fitted barely record what is behind the glass, so showing a pale tint
 * on them means amplifying a faint signal and its noise together. The four shot
 * with clear lenses need none of this and come out clean.
 */
const PALE_SMOOTH = Number(flag("smooth", "3"));
/**
 * How large a local difference has to be to count as a real edge rather than
 * noise, in luminance levels.
 *
 * Below the first figure the difference from the smoothed copy is discarded as
 * grain; above the second it is kept in full. The photographs' grain sits around
 * one to two levels while the temple arms are tens of levels from their
 * surroundings, so the two separate cleanly.
 */
const EDGE_LO = 2;
const EDGE_HI = 7;
const PALE_BOTTOM = 0.64;
/**
 * Percentile taken to be the darkest thing behind the glass, and where it should
 * land once the glass is removed.
 *
 * A dark glossy lens photographs with a surface reflection laid over whatever is
 * behind it, and that additive veil flattens what shows through. The four frames
 * shot with clear lenses put their darkest content at 0.10-0.11 of the
 * background; the six shot dark put it at 0.35-0.56. That gap is the veil, and
 * subtracting the offset that closes it normalises every frame to the same
 * contrast without touching the ones that never needed it.
 *
 * A fixed percentile for the black point cannot do this. These distributions
 * differ in width by a factor of five — PK008's spans 8 levels between its
 * quartiles where PK007's spans 130 — so one percentile is a gentle lift on one
 * frame and a 2.5x contrast blowout on the next. It clipped PK008's blue channel
 * outright, rendering a navy tint as electric blue.
 */
const FLOOR_RANK = Number(flag("floor", "0.02"));
const FLOOR_RATIO = Number(flag("clear", "0.10"));
/** Cap on the resulting contrast expansion, in case a lens has almost no range. */
const MAX_GAIN = 4;
/**
 * Transmittance the median lens pixel is normalised to, on every frame.
 *
 * Letting each frame's own background set its density makes the same tint land
 * differently depending on how that frame was photographed. A clear-lens frame
 * is mostly open background, so its median sits right up against its white
 * point (0.97 on PK010) where a frame shot dark sits well below it (0.76 on
 * PK002) — a 20-level gap between the two groups, which in a builder shows up
 * as one tint looking like two. Pinning the median keeps the multiply's local
 * contrast while making density a property of the tint rather than the shoot.
 */
const MID_TRANSMISSION = 0.8;
/**
 * Softness of the floor under that subtraction.
 *
 * Detrending takes out the shading that runs along the gradient axis, but not
 * the shadow the frame casts along the top rim, which is darker than its row.
 * Subtracting the black point hard drove that region to pure black on every
 * setting tried, giving the lens a flat crushed edge. A softplus toe lets it go
 * deep without ever reaching zero, and leaves the black point far less critical.
 */
const TOE = 0.08;
/** Percentile clipping when ranking the original lens pixels. */
const CLIP_LO = 0.02;
const CLIP_HI = 0.98;
/**
 * Highlights and metal are left exactly as photographed.
 *
 * A specular highlight is a reflection of the studio light, and a rivet is
 * metal — neither is glass, so neither should be remapped onto the tint.
 * Deciding that by rank went wrong: on frames with a broad highlight the top
 * fraction of a percent covered a wide area, and lifting it towards white
 * produced hard blown-out blobs across the lens. Absolute luminance is the
 * right test, and blending back to the original pixel keeps the highlight the
 * shape and colour the camera saw instead of inventing one.
 */
const PROTECT_LO = 185;
const PROTECT_HI = 230;
/**
 * ...and how far above the lens's own background it has to sit.
 *
 * Brightness alone does not identify a highlight. Four of these ten frames were
 * photographed with clear lenses, so the studio background seen through the
 * glass is itself brighter than 185: on PK007, PK009, PK010 and PK011 the
 * absolute test alone exempted 33-41% of the lens from tinting outright and a
 * further 3-6.5% completely, which is why their pale ends washed out to near
 * neutral — PK010's gradient finished at 181,165,158 against a specified
 * 139,91,58. On the six frames shot dark it exempted nothing.
 *
 * A specular is bright *relative to what surrounds it*, so both tests must pass.
 * Taking the lower of the two leaves those six frames untouched.
 */
const RELATIVE_LO = 1.3;
const RELATIVE_HI = 1.7;
/**
 * How far a gradient's transition reaches either side of the mid position, as a
 * fraction of the lens, at intensity 1 and intensity 0.
 *
 * The SVG compositor puts its two middle stops at mid ± (1 - intensity) * 18%,
 * confining the whole colour change to a band across the centre of the lens.
 * Baked into a photograph that reads as a stripe, and it is not what a gradient
 * lens looks like — the hand-retouched references fade across the full height.
 * These wider bounds keep the intensity control meaningful while defaulting to
 * a fade that covers nearly the whole lens.
 */
const FADE_MIN = 0.1;
const FADE_MAX = 0.7;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp255 = (n) => Math.max(0, Math.min(255, n));
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Shift a colour to a target luminance, keeping hue and saturation in range. */
function setLuminance(rgb, target) {
  const current = lum(...rgb);
  const delta = target - current;
  let out = rgb.map((v) => v + delta);
  const l = lum(...out);
  const min = Math.min(...out);
  const max = Math.max(...out);
  if (min < 0) out = out.map((v) => l + ((v - l) * l) / (l - min || 1));
  if (max > 255) out = out.map((v) => l + ((v - l) * (255 - l)) / (max - l || 1));
  return out.map(clamp255);
}

function db() {
  const env = Object.fromEntries(
    fs.readFileSync(".env", "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Mirrors isClassicTint in frontend/src/render/tint/lens-tint-spec.ts. */
const isClassic = (tint) =>
  tint.category === "classic" ||
  tint.gradient_top.trim().toLowerCase() ===
    (tint.gradient_bottom ?? tint.gradient_top).trim().toLowerCase();

/**
 * Position along the gradient axis for a point in a lens's bounding box, in the
 * same unit-square space the SVG gradient uses.
 */
function axisPosition(tint, u, v) {
  switch (tint.gradient_direction) {
    case "bottom-to-top":
      return 1 - v;
    case "left-to-right":
      return u;
    case "right-to-left":
      return 1 - u;
    case "custom": {
      // Matches getLinearGradientVector: the 0,0 -> 0,1 vector rotated about the
      // centre of the bounding box.
      const a = ((tint.gradient_angle ?? 180) * Math.PI) / 180;
      return 0.5 + (u - 0.5) * -Math.sin(a) + (v - 0.5) * Math.cos(a);
    }
    default:
      return v;
  }
}

/**
 * Measured transmittance colours, keyed by hex, from scripts/calibrate-tints.mjs.
 *
 * A hex is a flat swatch and a lens is glass with a thickness, so the two are
 * not the same colour: the references come out lighter than the hex on every
 * tint, and a fully saturated hex claims the coating passes nothing off-hue,
 * which no real lens does. Where a reference exists it measures what the hex
 * means; where one does not, the hex stands.
 */
const CALIBRATION = (() => {
  try {
    return JSON.parse(fs.readFileSync("scripts/tint-calibration.json", "utf8"));
  } catch {
    return {};
  }
})();

/** The tint's colour ramp along that axis, as a 256-entry lookup table. */
function gradientRamp(tint) {
  const top = hexToRgb(tint.gradient_top);
  if (isClassic(tint)) {
    const key = tint.gradient_top.replace("#", "").toLowerCase();
    return { top: CALIBRATION[key] ?? top, table: null };
  }
  const scale = CALIBRATION._gradient_scale ?? 1;
  const bottom = hexToRgb(tint.gradient_bottom);
  const mid = clamp01((tint.gradient_mid_position ?? 50) / 100);
  const half = FADE_MIN + (1 - clamp01(tint.gradient_intensity ?? 0.55)) * (FADE_MAX - FADE_MIN);
  const lo = mid - half;
  const hi = mid + half;
  const table = new Float64Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = clamp01((i / 255 - lo) / (hi - lo || 1));
    const s = x * x * (3 - 2 * x);
    for (let c = 0; c < 3; c++) table[i * 3 + c] = (top[c] + (bottom[c] - top[c]) * s) * scale;
  }
  return { top, table };
}

async function rasterise(pathD, w, h) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#000"/><path d="${pathD}" fill="#fff"/></svg>`;
  let img = sharp(Buffer.from(svg)).greyscale();
  if (INSET > 0) img = img.blur(INSET);
  const raw = await img.raw().toBuffer();
  if (INSET <= 0) return raw;
  // Blurring then clipping the top of the ramp erodes and feathers in one pass.
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw[i] <= 200 ? 0 : Math.round(((raw[i] - 200) / 55) * 255);
  }
  return out;
}

/**
 * One mask covering every lens, plus, for each pixel, which lens it belongs to
 * and that lens's bounding box. A gradient is evaluated per lens, so the two
 * lenses of a front view each fade across their own height instead of sharing
 * one ramp spanning the whole frame.
 */
async function lensMask(lenses, w, h) {
  const mask = Buffer.alloc(w * h);
  const owner = new Uint8Array(w * h);
  const boxes = [];
  for (let n = 0; n < lenses.length; n++) {
    const raw = await rasterise(lenses[n].pathD, w, h);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (raw[p] === 0) continue;
        if (raw[p] > mask[p]) {
          mask[p] = raw[p];
          owner[p] = n;
        }
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    boxes.push(x1 < 0 ? { x0: 0, y0: 0, w: w, h: h } : { x0, y0, w: x1 - x0 || 1, h: y1 - y0 || 1 });
  }
  return { mask, owner, boxes, width: w };
}

/**
 * Remove the photograph's own shading along the gradient axis, leaving the local
 * detail — the temple arms seen through the glass, texture, dust — around a flat
 * level. Bins are smoothed and interpolated so nothing bands.
 */
function profileDetrend(lums, axis, mask, idx) {
  const sum = new Float64Array(PROFILE_BINS);
  const count = new Float64Array(PROFILE_BINS);
  for (let k = 0; k < lums.length; k++) {
    if (mask[idx[k]] < 250) continue;
    const b = Math.min(PROFILE_BINS - 1, Math.floor(axis[k] * PROFILE_BINS));
    sum[b] += lums[k];
    count[b]++;
  }
  const raw = new Float64Array(PROFILE_BINS);
  let last = null;
  for (let b = 0; b < PROFILE_BINS; b++) {
    if (count[b] > 0) last = sum[b] / count[b];
    raw[b] = last ?? 0;
  }
  // Bins before the first populated one inherit it, going backwards.
  for (let b = PROFILE_BINS - 1; b >= 0; b--) if (count[b] === 0 && raw[b] === 0) raw[b] = raw[b + 1] ?? 0;
  const smooth = new Float64Array(PROFILE_BINS);
  for (let b = 0; b < PROFILE_BINS; b++) {
    const a = raw[Math.max(0, b - 1)];
    const c = raw[Math.min(PROFILE_BINS - 1, b + 1)];
    smooth[b] = (a + 2 * raw[b] + c) / 4;
  }
  let mean = 0;
  for (let k = 0; k < lums.length; k++) mean += lums[k];
  mean /= lums.length;

  const at = (t) => {
    const f = clamp01(t) * PROFILE_BINS - 0.5;
    const b = Math.floor(f);
    const lo = smooth[Math.max(0, Math.min(PROFILE_BINS - 1, b))];
    const hi = smooth[Math.max(0, Math.min(PROFILE_BINS - 1, b + 1))];
    return lo + (hi - lo) * clamp01(f - b);
  };
  const out = new Float64Array(lums.length);
  for (let k = 0; k < lums.length; k++) out[k] = lums[k] - at(axis[k]) + mean;
  return out;
}


/**
 * Clear-lens catalogue pages, one per frame, for the frames photographed with
 * dark lenses fitted.
 *
 * Those plates barely record what is behind the glass, so a pale tint built from
 * them amplifies the photograph's noise — patchy, or hazy once smoothed. The
 * supplier's catalogue shows the same frame with clear lenses: the arms and
 * background are plainly visible, and so is the lens edge. Front view sits in
 * the upper band of the page, side view in the lower.
 *
 * The two are different photographs, so the catalogue view is only used for
 * *what is behind the glass* — soft shapes that survive a 2x upscale and a few
 * percent of misalignment. The lens *boundary* comes from the plate itself: its
 * lens is dark grey where the frame is black or coloured, which is a cleaner
 * edge than either the hand-drawn outline or the warped catalogue.
 */
const CLEAR_DIR = "scripts/clear-lens";
/** Transmittance a pale tint's open background renders at, matching PALE_TOP. */
const CLEAR_LEVEL = 0.82;
/**
 * Edge detail borrowed from the plate when a catalogue page supplies the base.
 *
 * The catalogue is 842 pixels across the frame where the plate is 1849, so the
 * arms it contributes are soft. The plate's arm edges are sharp — the dark
 * tints, which use the plate directly, show it — and they survive a
 * high-pass as strong features while the grain that ruined the pale tints
 * does not. The gate keeps only the strong part, so the arm edge is restored
 * without the noise coming back with it.
 */
const DETAIL_GAIN = 0;
/**
 * Width, in pixels, of the band at the lens edge where the plate's own shading
 * shows through a pale tint.
 *
 * A dark tint keeps the photograph's bevel — the shadow where lens meets
 * frame — and that is a large part of why it reads as glass with depth.
 * Rebuilding a pale lens as flat colour lost it, and the lens looked pasted on.
 * Within this band the plate's transmittance is allowed to darken the flat base
 * so the same bevel comes back; further in, the base stays clean.
 */
const RIM_PX = 14;
const DETAIL_LO = 0.05;
const DETAIL_HI = 0.14;

/**
 * The two glasses on a catalogue page, by row: a frame occupies a wide run of
 * rows, the labels between them only a narrow one. Fixed page fractions broke
 * on pages where a label sits close under the glasses.
 */
async function pageBands(file) {
  // Work on a small copy: the two glasses are the two largest dark shapes on
  // the page, and at this size the labels are just specks.
  const SW = 240;
  const { data, info } = await sharp(file).flatten({ background: "#fff" }).greyscale()
    .resize(SW, null, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dark[i] = data[i] < 200 ? 1 : 0;
  const seen = new Uint8Array(W * H);
  const blobs = [];
  const stack = new Int32Array(W * H);
  for (let seed = 0; seed < W * H; seed++) {
    if (!dark[seed] || seen[seed]) continue;
    let sp = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    stack[sp++] = seed; seen[seed] = 1;
    while (sp) {
      const q = stack[--sp]; n++;
      const qx = q % W, qy = (q - qx) / W;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const r of [q - 1, q + 1, q - W, q + W, q - W - 1, q - W + 1, q + W - 1, q + W + 1]) {
        if (r >= 0 && r < W * H && dark[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r; }
      }
    }
    blobs.push({ n, y0, y1, area: (x1 - x0) * (y1 - y0) });
  }
  const big = blobs.sort((a, b) => b.area - a.area).slice(0, 2).sort((a, b) => a.y0 - b.y0);
  const meta = await sharp(file).metadata();
  const k = meta.height / H;
  const pad = 3;
  const band = (b) => [Math.max(0, Math.round((b.y0 - pad) * k)), Math.min(meta.height - 1, Math.round((b.y1 + pad) * k))];
  return { front: big[0] ? band(big[0]) : null, side: big[1] ? band(big[1]) : null };
}

function frameBox(data, info, y0, y1) {
  const C = info.channels;
  let x0 = info.width, by0 = info.height, x1 = -1, by1 = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * C;
    if (data[i + 3] < 128) continue;
    if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  return x1 < 0 ? null : { x0, y0: by0, w: x1 - x0, h: by1 - by0 };
}

async function clearLensSource(slug, axis, plateBuf, W, H, prior) {
  const file = path.join(CLEAR_DIR, `${slug}.png`);
  if (!fs.existsSync(file)) return null;
  const P = await sharp(plateBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pb = frameBox(P.data, P.info, 0, P.info.height);
  const T = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const band = (await pageBands(file))[axis];
  if (!band) return null;
  const tb = frameBox(T.data, T.info, band[0], band[1] + 1);
  if (!pb || !tb) return null;

  const cat = await sharp(file).extract({ left: tb.x0, top: tb.y0, width: tb.w + 1, height: tb.h + 1 })
    .resize(pb.w + 1, pb.h + 1, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const catLens = new Uint8Array(W * H);
  const behind = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < cat.info.height; y++) for (let x = 0; x < cat.info.width; x++) {
    const px = pb.x0 + x, py = pb.y0 + y;
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const ci = (y * cat.info.width + x) * cat.info.channels;
    const cr = cat.data[ci], cg = cat.data[ci + 1], cb = cat.data[ci + 2];
    const l = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
    const p = py * W + px;
    behind[p] = Math.round(l);
    // Lens interior is the white page or grey arms — bright and neutral. A
    // black frame fails on brightness; a cream or tortoiseshell one fails on
    // colour, which is what keeps PK008's pale frame from reading as lens.
    const csat = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
    catLens[p] = l > 95 && csat <= 20 ? 255 : 0;
  }
  const one = { raw: { width: W, height: H, channels: 1 } };
  const alphaSoft = await sharp(plateBuf).ensureAlpha().extractChannel(3).blur(5).raw().toBuffer();
  // Only inside the plate's frame silhouette. Where the catalogue shows a thin
  // or missing rim — PK005's near lens in side view, PK8018's lower edge — the
  // bright lens runs straight into the white page and a flood fill takes the
  // whole background with it. The plate is opaque across frame and lens alike,
  // so its silhouette walls the lens in regardless.
  for (let p = 0; p < W * H; p++) if (alphaSoft[p] < 252) catLens[p] = 0;
  // Clean lens shapes from the catalogue: close the gaps the arms cut, drop specks.
  // Closed hard: on PK008 the arms behind the glass are black, and without
  // this they cut arm-shaped holes clean through the lens shape.
  let shape = await sharp(Buffer.from(catLens), one).blur(16).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < shape.length; i++) shape[i] = shape[i] > 70 ? 255 : 0;
  shape = await sharp(shape, one).blur(16).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < shape.length; i++) shape[i] = shape[i] > 185 ? 255 : 0;
  // ...but never outside the plate's silhouette, which the dilation can cross.
  for (let i = 0; i < shape.length; i++) if (alphaSoft[i] < 252) shape[i] = 0;

  /**
   * Each lens is fitted to the plate separately.
   *
   * The catalogue and the plate are different photographs, and warping one
   * frame box onto the other leaves each lens a few percent off — enough that a
   * lens found by brightness in the plate also picks up the frame's glossy
   * corners, which read as the same dark grey. The catalogue's lens *shape* is
   * trustworthy: it is a real lens edge against a white page. Only its position
   * and size are uncertain, so those are searched for, scoring each candidate
   * by how much of it lands on lens-like plate and how much on black frame.
   */
  const plateLum = await sharp(plateBuf).flatten({ background: "#000" }).greyscale().blur(2).extractChannel(0).raw().toBuffer();
  const score = new Int8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (alphaSoft[p] < 252) { score[p] = -3; continue; }
    const i = p * P.info.channels;
    const r = P.data[i], g = P.data[i + 1], b = P.data[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const l = plateLum[p];
    score[p] = sat > 28 ? -3 : l < 26 ? -2 : l <= 160 ? 1 : 0;
  }

  // Connected components of the catalogue lens shape.
  const label = new Int32Array(W * H);
  const comps = [];
  const stack = new Int32Array(W * H);
  for (let seed = 0; seed < W * H; seed++) {
    if (!shape[seed] || label[seed]) continue;
    const id = comps.length + 1;
    let sp = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    const px = [];
    stack[sp++] = seed; label[seed] = id;
    while (sp) {
      const q = stack[--sp]; px.push(q);
      const qx = q % W, qy = (q - qx) / W;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const r of [q - 1, q + 1, q - W, q + W]) {
        if (r >= 0 && r < W * H && shape[r] && !label[r]) { label[r] = id; stack[sp++] = r; }
      }
    }
    // A lens is enclosed by the frame: it never touches the edge of the
    // catalogue crop (that is the page showing between the temple tips), and
    // its centre sits on the plate's frame silhouette.
    const touchesEdge = x0 <= pb.x0 + 1 || x1 >= pb.x0 + pb.w - 1 || y0 <= pb.y0 + 1 || y1 >= pb.y0 + pb.h - 1;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const onFrame = alphaSoft[Math.round(cy) * W + Math.round(cx)] >= 252;
    if (statsMode && px.length > 4000) console.log(`      ${slug} ${axis} shape ${px.length}px box ${x0}-${x1} x ${y0}-${y1}  edge:${touchesEdge} onFrame:${onFrame}  (crop ${pb.x0}-${pb.x0+pb.w} x ${pb.y0}-${pb.y0+pb.h})`);
    // The hand-drawn outline over-covers but is in the right place, so a real
    // lens sits mostly inside it and a stray shape does not.
    let inPrior = 0;
    for (let k = 0; k < px.length; k += 8) if (prior && prior[px[k]] > 128) inPrior++;
    const priorShare = prior ? inPrior / Math.ceil(px.length / 8) : 1;
    if (px.length > 4000 && !touchesEdge && onFrame && priorShare > 0.6) comps.push({ px, cx, cy });
  }

  const mask0 = new Uint8Array(W * H);
  const behindAligned = new Uint8Array(W * H).fill(255);
  const isLens = (p) => score[p] === 1 ? 1 : -1;
  const isFrame = (p) => score[p] < 0 ? 1 : score[p] === 1 ? -1 : 0;
  for (const c of comps) {
    /**
     * Score the boundary, not the area. Counting lens pixels covered rewards
     * shrinking, since a smaller shape fits inside the lens more easily and
     * the search ran to its limits. Asking instead for lens just inside the
     * edge and frame just outside rewards putting the edge on the transition,
     * which is the only thing that matters here.
     */
    const solo = new Uint8Array(W * H);
    for (const q of c.px) solo[q] = 255;
    const eroded = await sharp(Buffer.from(solo), one).blur(4).extractChannel(0).raw().toBuffer();
    const inner = [], outer = [];
    for (const q of c.px) if (eroded[q] < 250 && eroded[q] > 30) inner.push(q);
    const dil = await sharp(Buffer.from(solo), one).blur(4).extractChannel(0).raw().toBuffer();
    for (let q = 0; q < W * H; q++) if (!solo[q] && dil[q] > 30) outer.push(q);
    const inS = inner.filter((_, k) => k % 2 === 0), outS = outer.filter((_, k) => k % 2 === 0);
    // Width and height scale separately: the catalogue and plate side views
    // are not quite the same pose, and one scale left the near lens's lower
    // edge a few pixels out, which a pale tint shows and a dark one hides.
    let best = { s: -Infinity, dx: 0, dy: 0, sx: 1, sy: 1 };
    const evaluate = (sx, sy, dx, dy) => {
      let sum = 0;
      for (const q of inS) {
        const qx = q % W, qy = (q - qx) / W;
        const nx = Math.round(c.cx + (qx - c.cx) * sx + dx), ny = Math.round(c.cy + (qy - c.cy) * sy + dy);
        sum += (nx < 0 || nx >= W || ny < 0 || ny >= H) ? -1 : isLens(ny * W + nx);
      }
      for (const q of outS) {
        const qx = q % W, qy = (q - qx) / W;
        const nx = Math.round(c.cx + (qx - c.cx) * sx + dx), ny = Math.round(c.cy + (qy - c.cy) * sy + dy);
        sum += (nx < 0 || nx >= W || ny < 0 || ny >= H) ? 0 : isFrame(ny * W + nx);
      }
      return sum;
    };
    // coarse, then refine around the winner
    for (let sx = 0.92; sx <= 1.181; sx += 0.03) for (let sy = 0.92; sy <= 1.181; sy += 0.03)
      for (let dy = -48; dy <= 48; dy += 4) for (let dx = -60; dx <= 60; dx += 4) {
        const v = evaluate(sx, sy, dx, dy);
        if (v > best.s) best = { s: v, dx, dy, sx, sy };
      }
    const c0 = { ...best };
    for (let sx = c0.sx - 0.03; sx <= c0.sx + 0.031; sx += 0.01) for (let sy = c0.sy - 0.03; sy <= c0.sy + 0.031; sy += 0.01)
      for (let dy = c0.dy - 4; dy <= c0.dy + 4; dy += 1) for (let dx = c0.dx - 4; dx <= c0.dx + 4; dx += 1) {
        const v = evaluate(sx, sy, dx, dy);
        if (v > best.s) best = { s: v, dx, dy, sx, sy };
      }
    // Apply the fit by mapping every destination pixel back to its source.
    // Mapping forward instead leaves a lattice of unfilled pixels whenever the
    // scale is above one, which rendered as a grid across the lens.
    const id = label[c.px[0]];
    let sx0 = W, sy0 = H, sx1 = 0, sy1 = 0;
    for (const q of c.px) { const qx = q % W, qy = (q - qx) / W; if (qx < sx0) sx0 = qx; if (qx > sx1) sx1 = qx; if (qy < sy0) sy0 = qy; if (qy > sy1) sy1 = qy; }
    const fwd = (x, y) => [c.cx + (x - c.cx) * best.sx + best.dx, c.cy + (y - c.cy) * best.sy + best.dy];
    const [dx0, dy0] = fwd(sx0, sy0), [dx1, dy1] = fwd(sx1, sy1);
    for (let ny = Math.max(0, Math.floor(dy0) - 1); ny <= Math.min(H - 1, Math.ceil(dy1) + 1); ny++) {
      for (let nx = Math.max(0, Math.floor(dx0) - 1); nx <= Math.min(W - 1, Math.ceil(dx1) + 1); nx++) {
        const qx = Math.round(c.cx + (nx - best.dx - c.cx) / best.sx);
        const qy = Math.round(c.cy + (ny - best.dy - c.cy) / best.sy);
        if (qx < 0 || qx >= W || qy < 0 || qy >= H) continue;
        const q = qy * W + qx;
        if (label[q] !== id) continue;
        mask0[ny * W + nx] = 255;
        behindAligned[ny * W + nx] = behind[q];
      }
    }
    if (statsMode) console.log(`    ${slug} ${axis} lens fit: dx ${best.dx} dy ${best.dy} scale ${best.sx.toFixed(2)}x${best.sy.toFixed(2)}`);
  }
  /**
   * The fitted shape is only ever approximate: the catalogue and the plate are
   * different photographs at slightly different angles, so no rigid placement
   * matches the outline everywhere, and in side view it fell short of the real
   * lens edge by a visible band. The exact boundary comes from the plate — its
   * lens is dark grey where the frame is black — but searched only within a
   * tight margin of the fitted shape, which is what stops the frame's glossy
   * highlights being taken for lens the way they were before the fit existed.
   */
  const prior2 = await sharp(Buffer.from(mask0), one).blur(12).extractChannel(0).raw().toBuffer();
  const cand = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (prior2[p] > 40 && score[p] === 1) cand[p] = 255;
  // open: drop anything thinner than ~18px (highlights on the rim), keep the lens
  let pm = await sharp(Buffer.from(cand), one).blur(9).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < pm.length; i++) pm[i] = pm[i] > 205 ? 255 : 0;
  pm = await sharp(pm, one).blur(9).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < pm.length; i++) pm[i] = pm[i] > 50 && cand[i] ? 255 : 0;
  // the fitted shape's core is always lens, even where the plate is too dark to say
  const core = await sharp(Buffer.from(mask0), one).blur(4).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < pm.length; i++) if (core[i] > 240) pm[i] = 255;
  // close pinholes, feather
  pm = await sharp(pm, one).blur(3).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < pm.length; i++) pm[i] = pm[i] > 120 ? 255 : 0;
  const mask = await sharp(pm, one).blur(2).extractChannel(0).raw().toBuffer();
  for (let p = 0; p < W * H; p++) if (alphaSoft[p] < 252) mask[p] = 0;

  // Smooth the flat areas of what is behind the glass, keep the arm edges.
  const filled = await sharp(Buffer.from(behindAligned), one).blur(2).extractChannel(0).raw().toBuffer();
  const blurred = await sharp(filled, one).blur(6).extractChannel(0).raw().toBuffer();
  const kept = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const d = filled[p] - blurred[p];
    const m = Math.abs(d);
    // The page carries a compression grid of ten to twenty levels once upscaled;
    // the arms sit a hundred below the background. Raise the bar between them.
    const keep = m <= 30 ? 0 : m >= 60 ? 1 : (m - 30) / 30;
    kept[p] = Math.max(0, Math.min(255, Math.round(blurred[p] + d * keep)));
  }
  const soft = await sharp(Buffer.from(kept), one).blur(1.5).extractChannel(0).raw().toBuffer();
  const vals = [];
  for (let p = 0; p < W * H; p++) if (mask[p] === 255) vals.push(soft[p]);
  vals.sort((a, b) => a - b);
  const bg = vals[Math.floor(vals.length * 0.85)] || 255;
  const t = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) t[p] = Math.min(1, soft[p] / bg) * CLEAR_LEVEL;
  if (process.env.DEBUG_MASK) {
    const ov = Buffer.alloc(W * H * 4);
    for (let p = 0; p < W * H; p++) { const i = p * 4; ov[i] = 255; ov[i + 1] = 0; ov[i + 2] = 255; ov[i + 3] = Math.round(mask[p] * 0.55); }
    const base = await sharp(plateBuf).flatten({ background: "#fff" }).png().toBuffer();
    await sharp(base).composite([{ input: await sharp(ov, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), top: 0, left: 0 }]).png().toFile(`.tmp-maskdbg-${slug}-${axis}.png`);
  }
  // How far inside the lens each pixel is, for the rim shading.
  const inside = await sharp(pm, one).blur(7).extractChannel(0).raw().toBuffer();
  return { mask: Buffer.from(mask), t, inside };
}

async function recolour(plateBuf, lensMap, tint, w, h, label = "", clear = null) {
  const { data, info } = await sharp(plateBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  if (info.width !== w || info.height !== h) {
    throw new Error(`plate is ${info.width}x${info.height} but the clip config expects ${w}x${h}`);
  }
  const { mask, owner, boxes, width } = lensMap;
  const ramp = gradientRamp(tint);
  const flatTint = ramp.table ? null : ramp.top;
  const paleness = flatTint
    ? clamp01((lum(...flatTint) - FLATTEN_LO) / (FLATTEN_HI - FLATTEN_LO))
    : 0;

  // Smoothed copy of the plate, blended in by paleness before anything is
  // ranked, so the compression grain never reaches the transmittance at all.
  const smooth = await (async () => {
    if (paleness <= 0.01) return null;
    const grey = await sharp(plateBuf).greyscale().raw().toBuffer();
    const soft = await sharp(plateBuf).greyscale().blur(PALE_SMOOTH).raw().toBuffer();
    const out = new Float32Array(grey.length);
    for (let i = 0; i < grey.length; i++) {
      const detail = grey[i] - soft[i];
      const mag = Math.abs(detail);
      const keep = mag <= EDGE_LO ? 0 : mag >= EDGE_HI ? 1 : (mag - EDGE_LO) / (EDGE_HI - EDGE_LO);
      out[i] = soft[i] + detail * keep;
    }
    return out;
  })();

  // Rank every lens pixel within this lens's own luminance distribution.
  const idx = [];
  const lums = [];
  const rawLums = [];
  const axis = flatTint ? null : [];
  const core = [];
  for (let p = 0; p < info.width * info.height; p++) {
    if (mask[p] === 0) continue;
    const i = p * ch;
    if (data[i + 3] < 32) continue;
    const raw = lum(data[i], data[i + 1], data[i + 2]);
    const l = smooth ? raw * (1 - paleness) + smooth[p] * paleness : raw;
    idx.push(p);
    lums.push(l);
    rawLums.push(raw);
    if (axis) {
      const box = boxes[owner[p]];
      const x = p % width;
      axis.push(clamp01(axisPosition(tint, (x - box.x0) / box.w, ((p - x) / width - box.y0) / box.h)));
    }
    // Statistics come from full-weight pixels only. The feathered edge overlaps
    // the frame, and letting those dark pixels into the distribution drags the
    // percentiles down and darkens the whole lens with them.
    if (mask[p] >= 250) core.push(l);
  }
  if (!idx.length) return null;

  /**
   * For a gradient, rank against the photograph's own shading at the same point
   * on the axis rather than against the whole lens.
   *
   * Otherwise the two fight: these lenses are photographed with a shadow along
   * the bottom rim, so the bottom pixels rank near zero and get pulled dark no
   * matter what colour the gradient asks for there. Measured on PK002 that
   * cancelled the fade outright — the lens ran 123 down to 83 top to bottom
   * where the retouched reference runs 90 up to 172. Subtracting the shading
   * profile leaves the local detail, which is what should survive; the level is
   * the gradient's to set.
   */
  const detrend = axis ? profileDetrend(lums, axis, mask, idx) : null;
  const ranked = detrend ?? lums;
  const rankedCore = detrend
    ? idx.map((p, k) => (mask[p] >= 250 ? detrend[k] : -1)).filter((v) => v >= 0)
    : core;

  // True percentile rank, via a 256-bin CDF of the core pixels. Stretching the
  // value range linearly instead looks equivalent but is not: these lens
  // histograms are right-skewed by the studio highlight, which pushed the median
  // pixel to rank 0.21 and darkened every lens by about a quarter.
  // The background level as photographed, before any detrending: what a specular
  // has to stand out against.
  const rawSample = core.length > 64 ? core : lums;
  const rawHist = new Float64Array(256);
  for (const l of rawSample) rawHist[Math.max(0, Math.min(255, Math.round(l)))]++;
  let rawAcc = 0;
  let background = 255;
  for (let v = 0; v < 256; v++) {
    rawAcc += rawHist[v];
    if (rawAcc / rawSample.length >= 0.85) { background = Math.max(1, v); break; }
  }

  const sample = rankedCore.length > 64 ? rankedCore : ranked;
  const hist = new Float64Array(256);
  for (const l of sample) hist[Math.max(0, Math.min(255, Math.round(l)))]++;
  const cdf = new Float64Array(256);
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    cdf[v] = acc / sample.length;
  }
  const rankOf = (l) => cdf[Math.max(0, Math.min(255, Math.round(l)))];
  // Re-spread so the clipped tails map to the ends rather than compressing.
  const rLo = CLIP_LO;
  const rHi = CLIP_HI;

  // Fitted against the hand-retouched references: #5A0000 (tint luma 19) lands
  // at a lens median of 43, #2B2B2B (tint luma 43) at 61. With the median pixel
  // now sitting at rank 0.5, that solves to this line.
  const midToneFor = (tintLum) => Math.max(20, Math.min(150, 0.65 * tintLum + 25));
  const flatMid = flatTint ? midToneFor(lum(...flatTint)) : 0;
  const outLo = flatMid * RANGE_LO;
  const outHi = flatMid * RANGE_HI;

  /**
   * Where the studio background sits once the lens's own shading is removed.
   * Under the transmittance model this is the pixel that comes out as the tint
   * colour itself, and everything darker comes out proportionally darker.
   *
   * It is the mode of the upper half of the distribution, not a high percentile.
   * Detrending flattens the background to about the lens mean, so a percentile
   * up near the top picks specular highlights instead and renders the whole lens
   * far too dark — measured on PK002 that put the pale end at 98-120 where the
   * reference sits at 162-166. The background is the largest bright feature in
   * a lens, so the mode finds it.
   */
  let whitePoint = 255;
  let blackPoint = 0;
  {
    const at = (r) => { for (let v = 0; v < 256; v++) if (cdf[v] >= r) return v; return 255; };
    whitePoint = Math.max(1, at(0.85));
    const floor = at(FLOOR_RANK);
    blackPoint = Math.max(0, (floor - FLOOR_RATIO * whitePoint) / (1 - FLOOR_RATIO));
    blackPoint = Math.min(blackPoint, whitePoint * (1 - 1 / MAX_GAIN));
    if (statsMode) {
      const at = (r) => { for (let v = 0; v < 256; v++) if (cdf[v] >= r) return v; return 255; };
      const span0 = Math.max(1, whitePoint - blackPoint);
      console.log(
        `  ${label.padEnd(16)} p02 ${String(at(0.02)).padStart(3)}` +
        `  p50 ${String(at(0.5)).padStart(3)}  p85 ${String(whitePoint).padStart(3)}` +
        `  p99 ${String(at(0.99)).padStart(3)}` +
        `  black ${String(Math.round(blackPoint)).padStart(3)}` +
        `  gain ${(whitePoint / span0).toFixed(2)}` +
        `  t(p99) ${((at(0.99) - blackPoint) / span0).toFixed(2)}` +
        `  t(p02) ${(Math.max(0, at(0.02) - blackPoint) / span0).toFixed(2)}`,
      );
    }
  }
  const span = Math.max(1, whitePoint - blackPoint);
  // Brightest channel this tint ever asks for, across the whole ramp.
  const peak = flatTint
    ? Math.max(...flatTint)
    : ramp.table.reduce((m, v) => (v > m ? v : m), 1);
  const ceiling = Math.min(MAX_TRANSMISSION, 255 / Math.max(1, peak));
  const shoulder = Math.min(SHOULDER, ceiling * 0.9);
  const headroom = Math.max(1e-6, ceiling - shoulder);
  const atRank = (r) => { for (let v = 0; v < 256; v++) if (cdf[v] >= r) return v; return 255; };
  const normalise = (() => {
    let median = whitePoint;
    for (let v = 0; v < 256; v++) if (cdf[v] >= 0.5) { median = v; break; }
    const midT = Math.max(0.05, (median - blackPoint) / span);
    return MID_TRANSMISSION / midT;
  })();

  /**
   * How much of the photograph's shading survives.
   *
   * Gradients are left alone: the two references that track their specified hex
   * already match, and the other two are lighter than the hex by intent.
   */
  /**
   * Flattened further, where needed, to fit under this tint's ceiling.
   *
   * A pale tint has almost no headroom before its brightest channel pins at 255,
   * and the six frames shot with dark lenses need their contrast expanded by up
   * to 2x to lift the veil. Together those put 35-41% of such a lens hard against
   * the ceiling as one flat slab of colour, against 0-4% on the frames needing no
   * expansion. Scaling the spread so the top of the distribution lands on the
   * ceiling rather than past it keeps the shading continuous, and costs nothing
   * on a dark tint, which has several times the headroom it needs.
   */
  /**
   * How much of the photographed surface reflection a tint keeps.
   *
   * A specular is a fixed quantity of light bouncing off the front of the glass,
   * so what matters is how it compares to whatever else the lens is showing.
   * Against a near-black lens it is the brightest thing there and reads as a
   * glint; against a pale one it is barely above the background and all but
   * disappears. Leaving it at full strength regardless is what made the pale
   * tints look like mirror coating: the reference green holds its brightest
   * areas 1.01x its own mid-tone, where keeping the photographed highlight put
   * that at 1.25-1.39.
   *
   * It has to be faded here rather than simply capped, because a protected pixel
   * is the untouched photograph and so bypasses the ceiling entirely.
   *
   * Read from the colour at that pixel, so a gradient keeps its glint across the
   * dark end and loses it towards the pale end, as the same lens would.
   */
  const specularVisibilityAt = (rgb) =>
    1 - clamp01((lum(...rgb) - FLATTEN_LO) / (FLATTEN_HI - FLATTEN_LO));

  const topT = ((atRank(0.99) - blackPoint) / span) * normalise;
  const toFit = (ceiling - MID_TRANSMISSION) / Math.max(1e-6, topT - MID_TRANSMISSION);
  // Compression that puts the 97th percentile on the pale target, blended in by
  // how pale the tint is so a dark tint keeps its surface untouched.
  const rawTop = ((atRank(0.97) - blackPoint) / span) * normalise - MID_TRANSMISSION;
  const fitTop = rawTop > 0
    ? clamp01((MID_TRANSMISSION * (PALE_TOP - 1)) / rawTop)
    : 1;
  const contrastAbove = Math.min(1 + (fitTop - 1) * paleness, Math.max(0.05, toFit));
  // The same solve for the arms below the mid-tone, which must stay clearly
  // visible: the reference holds them at 0.64 of the lens level, and left alone
  // the frames spread from 0.51 to 0.76 for the same reason the top end did.
  const rawBottom = ((atRank(0.1) - blackPoint) / span) * normalise - MID_TRANSMISSION;
  const fitBottom = rawBottom < 0
    ? Math.min(1, (MID_TRANSMISSION * (PALE_BOTTOM - 1)) / rawBottom)
    : 1;
  const contrastBelow = 1 + (fitBottom - 1) * paleness;

  if (statsMode) {
    const tOf = (r) => {
      const sp = ((atRank(r) - blackPoint) / span) * normalise - MID_TRANSMISSION;
      return MID_TRANSMISSION + sp * (sp > 0 ? contrastAbove : contrastBelow);
    };
    console.log(
      `  ${label.padEnd(14)} paleness ${paleness.toFixed(2)}  cAbove ${contrastAbove.toFixed(3)}` +
      `  cBelow ${contrastBelow.toFixed(2)}  toFit ${toFit.toFixed(2)}` +
      `  t10 ${tOf(0.1).toFixed(2)}  t50 ${tOf(0.5).toFixed(2)}` +
      `  t90 ${tOf(0.9).toFixed(2)}  t97 ${tOf(0.97).toFixed(2)}`,
    );
  }

  let detail = null;
  if (clear) {
    // Plate transmittance before any flattening, as an image, then its high-pass.
    const tImg = Buffer.alloc(info.width * info.height);
    for (let k = 0; k < idx.length; k++) {
      const v = ((ranked[k] - blackPoint) / span) * normalise;
      tImg[idx[k]] = Math.max(0, Math.min(255, Math.round(v * 100)));
    }
    // Fill outside the lens with the local mean so the blur does not drag the
    // edge towards zero.
    const one = { raw: { width: info.width, height: info.height, channels: 1 } };
    const low = await sharp(tImg, one).blur(30).extractChannel(0).raw().toBuffer();
    detail = new Float32Array(info.width * info.height);
    for (let k = 0; k < idx.length; k++) {
      const p = idx[k];
      const hp = (tImg[p] - low[p]) / 100;
      const m = Math.abs(hp);
      const keep = m <= DETAIL_LO ? 0 : m >= DETAIL_HI ? 1 : (m - DETAIL_LO) / (DETAIL_HI - DETAIL_LO);
      detail[p] = hp * keep * DETAIL_GAIN;
    }
  }

  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    const i = p * ch;
    const grey = rawLums[k];
    let r;
    let g;
    let b;

    /**
     * A tinted lens is an absorbing filter, so it multiplies rather than
     * replaces: what is behind the glass keeps its contrast and is scaled by
     * the coating's transmittance.
     *
     * Remapping each pixel onto an absolute luminance instead pins local
     * contrast at a fixed spread however light the tint is, so a pale lens comes
     * out as flat colour rather than glass, and its chroma comes out diluted
     * because the photograph's own grey is mixed into it. Measured against the
     * references that cost 43 levels of blue on #D7D51D and 22 on #E3BC86,
     * where this path lands within 4 levels on every channel.
     */
    let tintRgb = flatTint;
    if (!tintRgb) {
      const s = Math.round(axis[k] * 255) * 3;
      tintRgb = [ramp.table[s], ramp.table[s + 1], ramp.table[s + 2]];
    }
    const spread = ((ranked[k] - blackPoint) / span) * normalise - MID_TRANSMISSION;
    const rawT = MID_TRANSMISSION + spread * (spread > 0 ? contrastAbove : contrastBelow);
    const toed = rawT > TOE * 8 ? rawT : TOE * Math.log1p(Math.exp(rawT / TOE));
    const transmission =
      toed <= shoulder
        ? toed
        : shoulder + headroom * (1 - Math.exp(-(toed - shoulder) / headroom));
    let tFinal = transmission;
    if (clear) {
      const pale = clamp01((lum(...tintRgb) - FLATTEN_LO) / (FLATTEN_HI - FLATTEN_LO)) * (clear.lensMask[p] / 255);
      let base = clear.t[p] + (detail ? detail[p] : 0);
      // inside: 255 deep in the lens, falling to ~128 at the edge over ~2*blur
      const depth = Math.max(0, Math.min(1, (clear.inside[p] - 128) / 100));
      const rim = 1 - depth;
      // never darker than a fraction of the base: a bevel, not a black ring
      if (rim > 0) base = base * (1 - rim) + Math.max(0.5 * base, Math.min(base, transmission)) * rim;
      tFinal = transmission * (1 - pale) + base * pale;
    }
    r = clamp255(tintRgb[0] * tFinal);
    g = clamp255(tintRgb[1] * tFinal);
    b = clamp255(tintRgb[2] * tFinal);
    const absolute =
      grey <= PROTECT_LO ? 0
      : grey >= PROTECT_HI ? 1
      : (grey - PROTECT_LO) / (PROTECT_HI - PROTECT_LO);
    const ratio = grey / background;
    const relative =
      ratio <= RELATIVE_LO ? 0
      : ratio >= RELATIVE_HI ? 1
      : (ratio - RELATIVE_LO) / (RELATIVE_HI - RELATIVE_LO);
    // Outside the clean lens shape the photograph is in charge again, and its
    // rivets are metal whatever the tint: keep them protected there.
    const specVis = clear ? Math.max(specularVisibilityAt(tintRgb), 1 - clear.lensMask[p] / 255) : specularVisibilityAt(tintRgb);
    const protect = Math.min(absolute, relative) * specVis;
    const wgt = (mask[p] / 255) * (1 - protect);
    data[i] = Math.round(data[i] * (1 - wgt) + r * wgt);
    data[i + 1] = Math.round(data[i + 1] * (1 - wgt) + g * wgt);
    data[i + 2] = Math.round(data[i + 2] * (1 - wgt) + b * wgt);
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}

const supabase = db();
const frames = (await supabase.from("frames").select("id,slug,is_active")).data
  .filter((f) => f.is_active && f.slug.startsWith("pk"))
  .filter((f) => !onlyFrame || f.slug === onlyFrame.toLowerCase());
const views = (await supabase.from("frame_render_views").select("frame_id,view_axis,plate_url,image_width,image_height,clip_config")).data;
const tints = (await supabase
  .from("sunglasses_lens_tints")
  .select("code,name,category,gradient_top,gradient_bottom,gradient_direction,gradient_angle,gradient_mid_position,gradient_intensity,is_active")
  .eq("is_active", true)).data
  .filter((t) => !onlyTint || t.gradient_top.replace("#", "").toLowerCase() === onlyTint.replace("#", "").toLowerCase());

if (!frames.length) { console.error("no matching frames"); process.exit(1); }
if (!tints.length) { console.error("no matching tints"); process.exit(1); }
if (!dryRun) fs.mkdirSync(outDir, { recursive: true });

const gradients = tints.filter((t) => !isClassic(t)).length;
console.log(`${frames.length} frame(s) x ${tints.length} tint(s) (${gradients} gradient) x 2 views\n`);
const plateCache = new Map();
let made = 0;
const skipped = [];

for (const frame of frames) {
  for (const axis of VIEWS) {
    const view = views.find((v) => v.frame_id === frame.id && v.view_axis === axis);
    if (!view) { skipped.push(`${frame.slug} ${axis}: no view`); continue; }
    const lenses = view.clip_config?.lenses ?? [];
    if (!lenses.length) { skipped.push(`${frame.slug} ${axis}: no lens polygons`); continue; }

    if (!plateCache.has(view.plate_url)) {
      plateCache.set(view.plate_url, Buffer.from(await (await fetch(view.plate_url)).arrayBuffer()));
    }
    const plate = plateCache.get(view.plate_url);
    const lensMap = await lensMask(lenses, view.image_width, view.image_height);
    const clear = await clearLensSource(frame.slug, axis, plate, view.image_width, view.image_height, lensMap.mask);
    if (clear) {
      // Where the clean lens shape reaches, the flat base is used. Where only
      // the hand-drawn outline reaches — the deep shadow at the lower edge of
      // a side-view lens, black in the plate and beyond either source — the
      // photographic path takes over, so the tint continues into shadow instead
      // of stopping at a hard band of untinted plate.
      clear.lensMask = clear.mask;
      const union = Buffer.alloc(lensMap.mask.length);
      for (let i = 0; i < union.length; i++) union[i] = Math.max(lensMap.mask[i], clear.mask[i]);
      lensMap.mask = union;
    }

    for (const tint of tints) {
      const hex = tint.gradient_top.replace("#", "").toLowerCase();
      const name = `${frame.slug}-${axis}-${hex}.png`;
      try {
        const out = await recolour(plate, lensMap, tint, view.image_width, view.image_height, `${frame.slug} ${axis}`, clear);
        if (!out) { skipped.push(`${frame.slug} ${axis} ${hex}: empty lens mask`); continue; }
        if (!dryRun) fs.writeFileSync(path.join(outDir, name), out);
        made++;
        if (made % 20 === 0 || tints.length === 1) console.log(`  ${name}  (${tint.code})`);
      } catch (err) {
        skipped.push(`${frame.slug} ${axis} ${hex}: ${err.message}`);
      }
    }
  }
}

console.log(`\n${dryRun ? "Would write" : "Wrote"} ${made} plate(s)${dryRun ? "" : ` to ${outDir}`}`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length}:`);
  for (const s of skipped.slice(0, 12)) console.log(`  ${s}`);
}
