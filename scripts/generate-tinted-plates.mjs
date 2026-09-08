/**
 * Generate per-tint frame plates by recolouring the lens region of the live
 * product photos — no manual retouching, no contact sheets.
 *
 *   node scripts/generate-tinted-plates.mjs [--tint 5A0000] [--frame pk002]
 *                                           [--out <dir>] [--sat 0.63]
 *
 * Everything needed is already in the database: the full-resolution plate for
 * every frame and view, and the lens polygons drawn in admin. This masks to
 * those polygons and remaps the photographed lens onto the tint.
 *
 * The remap is percentile-based rather than a straight multiply. Each pixel
 * keeps its rank within that lens's own luminance distribution and is mapped
 * onto a target range derived from the tint, so a frame photographed with a
 * clear lens and one photographed with a near-black lens both land at the same
 * density — four of these ten frames were shot light, six dark. Hue comes from
 * the tint at partial saturation, matching the hand-made references (0.62-0.64).
 *
 * Rank is a real percentile, not a normalised value. The difference matters:
 * the studio highlight gives these histograms a long bright tail, so a linear
 * stretch puts the median pixel around rank 0.2 and renders every lens far
 * darker than the reference.
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
const dryRun = args.includes("--dry");

/** Where the recoloured lens sits, as a multiple of the target mid-tone. */
const RANGE_LO = 0.45;
const RANGE_HI = 1.85;
/** Percentile clipping when ranking the original lens pixels. */
const CLIP_LO = 0.02;
const CLIP_HI = 0.98;
/**
 * Only the very top of the range is lifted towards white. The studio highlight
 * on these plates is broad, and lifting it turns into a grey smear across the
 * lens; the hand-retouched references flatten it away entirely. This narrow
 * window leaves the sheen as a slightly lighter tint and keeps just the metal
 * rivets — which sit inside the lens polygon on several frames — reading bright.
 */
const SPECULAR_FROM = 0.992;
const SPECULAR_LIFT = 0.9;
/**
 * Where the lens stops taking the tint. A highlight reflects the light source,
 * not the glass, so it stays near-white — and the metal rivets, which fall
 * inside the lens polygon on several of these frames, stay metal rather than
 * turning pink.
 */
const NEUTRAL_FROM = 0.985;
const NEUTRAL_SAT = 0.10;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp255 = (n) => Math.max(0, Math.min(255, n));
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

async function lensMask(lenses, w, h) {
  const paths = lenses.map((l) => `<path d="${l.pathD}" fill="#fff"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#000"/>${paths}</svg>`;
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

async function recolour(plateBuf, mask, tint, w, h) {
  const { data, info } = await sharp(plateBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  if (info.width !== w || info.height !== h) {
    throw new Error(`plate is ${info.width}x${info.height} but the clip config expects ${w}x${h}`);
  }

  // Rank every lens pixel within this lens's own luminance distribution.
  const idx = [];
  const lums = [];
  const core = [];
  for (let p = 0; p < info.width * info.height; p++) {
    if (mask[p] === 0) continue;
    const i = p * ch;
    if (data[i + 3] < 32) continue;
    const l = lum(data[i], data[i + 1], data[i + 2]);
    idx.push(p);
    lums.push(l);
    // Statistics come from full-weight pixels only. The feathered edge overlaps
    // the frame, and letting those dark pixels into the distribution drags the
    // percentiles down and darkens the whole lens with them.
    if (mask[p] >= 250) core.push(l);
  }
  if (!idx.length) return null;

  // True percentile rank, via a 256-bin CDF of the core pixels. Stretching the
  // value range linearly instead looks equivalent but is not: these lens
  // histograms are right-skewed by the studio highlight, which pushed the median
  // pixel to rank 0.21 and darkened every lens by about a quarter.
  const sample = core.length > 64 ? core : lums;
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

  const tintLum = lum(...tint);
  // Fitted against the hand-retouched references: #5A0000 (tint luma 19) lands
  // at a lens median of 43, #2B2B2B (tint luma 43) at 61. With the median pixel
  // now sitting at rank 0.5, that solves to this line.
  const targetMid = Math.max(20, Math.min(150, 0.65 * tintLum + 25));
  const outLo = targetMid * RANGE_LO;
  const outHi = targetMid * RANGE_HI;

  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    const i = p * ch;
    const rank = Math.max(0, Math.min(1, (rankOf(lums[k]) - rLo) / (rHi - rLo)));
    let target = outLo + (outHi - outLo) * rank;
    // Keep the brightest few percent reading as a highlight on the glass.
    if (rank > SPECULAR_FROM) {
      const over = (rank - SPECULAR_FROM) / (1 - SPECULAR_FROM);
      target += (255 - target) * over * SPECULAR_LIFT;
    }
    const grey = lums[k];
    const fade = rank <= NEUTRAL_FROM ? 0 : (rank - NEUTRAL_FROM) / (1 - NEUTRAL_FROM);
    const sat = SAT_KEEP * (1 - fade * (1 - NEUTRAL_SAT));
    const mixed = [
      grey * (1 - sat) + tint[0] * sat,
      grey * (1 - sat) + tint[1] * sat,
      grey * (1 - sat) + tint[2] * sat,
    ];
    const [r, g, b] = setLuminance(mixed, target);
    const wgt = mask[p] / 255;
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
const tints = (await supabase.from("sunglasses_lens_tints").select("code,name,gradient_top,gradient_bottom,is_active").eq("is_active", true)).data
  .filter((t) => !onlyTint || t.gradient_top.replace("#", "").toLowerCase() === onlyTint.replace("#", "").toLowerCase());

if (!frames.length) { console.error("no matching frames"); process.exit(1); }
if (!tints.length) { console.error("no matching tints"); process.exit(1); }
if (!dryRun) fs.mkdirSync(outDir, { recursive: true });

console.log(`${frames.length} frame(s) x ${tints.length} tint(s) x 2 views\n`);
const plateCache = new Map();
let made = 0;
const skipped = [];

for (const frame of frames) {
  for (const axis of ["front", "side"]) {
    const view = views.find((v) => v.frame_id === frame.id && v.view_axis === axis);
    if (!view) { skipped.push(`${frame.slug} ${axis}: no view`); continue; }
    const lenses = view.clip_config?.lenses ?? [];
    if (!lenses.length) { skipped.push(`${frame.slug} ${axis}: no lens polygons`); continue; }

    if (!plateCache.has(view.plate_url)) {
      plateCache.set(view.plate_url, Buffer.from(await (await fetch(view.plate_url)).arrayBuffer()));
    }
    const plate = plateCache.get(view.plate_url);
    const mask = await lensMask(lenses, view.image_width, view.image_height);

    for (const tint of tints) {
      const hex = tint.gradient_top.replace("#", "").toLowerCase();
      const name = `${frame.slug}-${axis}-${hex}.png`;
      try {
        const out = await recolour(plate, mask, hexToRgb(tint.gradient_top), view.image_width, view.image_height);
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
