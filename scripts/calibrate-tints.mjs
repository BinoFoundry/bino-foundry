/**
 * Fit each tint's effective transmittance colour from a hand-retouched reference.
 *
 *   node scripts/calibrate-tints.mjs [--write]
 *
 * The generator treats a lens as an absorbing filter: output = tint x
 * transmittance. That gets hue and local contrast right, but the tint's own hex
 * is not the colour the coating actually transmits. A hex is a flat swatch; a
 * lens is glass with a thickness, and a fully saturated hex like #5A0000 says
 * the coating passes no green or blue at all, which no real lens does — the
 * references carry 17-18 levels of both.
 *
 * So the hex sets the intent and a reference measures what it means. Since
 * output is linear in the tint colour, the correction is one division per
 * channel: colour x median(reference) / median(current output), sampled over the
 * lens through each image's own frame bounding box, because the two sets are
 * cropped and scaled differently.
 *
 * Gradients are left alone. Both gradient tints with an unambiguous reference
 * already land within 4 levels per channel, and on the other two the reference
 * is deliberately lighter than the specified hex rather than the generator being
 * wrong, so calibrating to them would encode a preference as a correction.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const write = process.argv.includes("--write");
const DIR = "frontend/public/tint-proto";
const OUT = "scripts/tint-calibration.json";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const frames = (await supabase.from("frames").select("id,slug,is_active")).data
  .filter((f) => f.is_active && f.slug.startsWith("pk"));
const views = (await supabase.from("frame_render_views")
  .select("frame_id,view_axis,image_width,image_height,clip_config")).data;
const tints = (await supabase.from("sunglasses_lens_tints")
  .select("code,category,gradient_top,gradient_bottom,is_active").eq("is_active", true)).data;

const isClassic = (t) =>
  t.category === "classic" ||
  t.gradient_top.trim().toLowerCase() === (t.gradient_bottom ?? t.gradient_top).trim().toLowerCase();

async function maskFor(lenses, w, h) {
  const paths = lenses.map((l) => `<path d="${l.pathD}" fill="#fff"/>`).join("");
  const raw = await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#000"/>${paths}</svg>`,
  )).greyscale().blur(30).raw().toBuffer();
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] >= 252 ? 255 : 0;
  return out;
}

function frameBox(data, info) {
  const C = info.channels;
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * C;
      if (data[i + 3] < 128) continue;
      if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, w: x1 - x0 || 1, h: y1 - y0 || 1 };
}

/** Median r,g,b over the lens, sampled through the bbox mapping. */
function sampleLens(data, info, box, mask, mw, mh, mbox) {
  const C = info.channels;
  const chans = [[], [], []];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const u = (x - box.x0) / box.w;
      const v = (y - box.y0) / box.h;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const mx = Math.round(mbox.x0 + u * mbox.w);
      const my = Math.round(mbox.y0 + v * mbox.h);
      if (mx < 0 || mx >= mw || my < 0 || my >= mh) continue;
      if (mask[my * mw + mx] === 0) continue;
      const i = (y * info.width + x) * C;
      if (data[i + 3] < 128) continue;
      chans[0].push(data[i]); chans[1].push(data[i + 1]); chans[2].push(data[i + 2]);
    }
  }
  if (!chans[0].length) return null;
  return chans.map((c) => { c.sort((a, b) => a - b); return c[Math.floor(c.length / 2)]; });
}

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/**
 * The colour the generator actually used for this tint on the staged output.
 * Fitting against that rather than the raw hex makes the fit idempotent, so
 * re-running on an already-calibrated set reproduces the same numbers instead
 * of compounding the correction.
 */
const PREVIOUS = (() => {
  try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { return {}; }
})();
const colourUsed = (hex) => PREVIOUS[hex] ?? hexToRgb(hex);

const ratios = new Map();
for (const frame of frames) {
  for (const axis of ["front", "side"]) {
    const view = views.find((v) => v.frame_id === frame.id && v.view_axis === axis);
    const lenses = view?.clip_config?.lenses ?? [];
    if (!lenses.length) continue;
    const mask = await maskFor(lenses, view.image_width, view.image_height);
    for (const tint of tints) {
      const hex = tint.gradient_top.replace("#", "").toLowerCase();
      const gFile = path.join(DIR, `gen-${frame.slug}-${axis}-${hex}.png`);
      const yFile = path.join(DIR, `${frame.slug}-${axis}-${hex}.png`);
      if (!fs.existsSync(gFile) || !fs.existsSync(yFile)) continue;
      const g = await sharp(gFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const y = await sharp(yFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const gBox = frameBox(g.data, g.info);
      const gMed = sampleLens(g.data, g.info, gBox, mask, view.image_width, view.image_height, gBox);
      const yMed = sampleLens(y.data, y.info, frameBox(y.data, y.info), mask, view.image_width, view.image_height, gBox);
      if (!gMed || !yMed) continue;
      if (!ratios.has(hex)) ratios.set(hex, []);
      // Recover the transmittance this lens rendered at, from whichever channels
      // the hex actually carries, then read the reference's colour at it. Going
      // via transmittance rather than a per-channel ratio is what lets a fully
      // saturated hex gain an off-hue floor: #5A0000 has no green to scale.
      const used = colourUsed(hex);
      const ts = [0, 1, 2].filter((c) => used[c] >= 24).map((c) => gMed[c] / used[c]);
      if (!ts.length) continue;
      ts.sort((a, b) => a - b);
      ratios.get(hex).push({ t: ts[Math.floor(ts.length / 2)], y: yMed, g: gMed, classic: isClassic(tint) });
    }
  }
}

const median = (a) => { const s = a.filter((n) => n != null).sort((x, z) => x - z); return s.length ? s[Math.floor(s.length / 2)] : null; };
const calibration = {};
console.log("tint       hex ->  calibrated transmittance colour   (ratio, n)");
/**
 * Gradients keep their specified colours; only the overall density is measured.
 *
 * Two of the four gradient references sit deliberately lighter than the hex they
 * name — #2A120C reads 73,39,24 against a specified 42,18,12 — so fitting a
 * colour to them would bake a preference in as a correction. The other two track
 * the spec closely, and the residual on those is a pure scale left over from
 * pinning the median transmittance, so that is all this takes from them.
 */
const SPEC_FAITHFUL = ["4a4a4a", "2a2f73"];
const gradientScales = [];
for (const hex of SPEC_FAITHFUL) {
  for (const r of ratios.get(hex) ?? []) {
    for (let c = 0; c < 3; c++) if (r.g[c] >= 24) gradientScales.push(r.y[c] / r.g[c]);
  }
}

for (const [hex, rows] of ratios) {
  if (!rows[0].classic) continue;
  const base = hexToRgb(hex);
  const t = median(rows.map((x) => x.t));
  const out = [0, 1, 2].map((c) =>
    Math.round(Math.max(0, Math.min(255, median(rows.map((x) => x.y[c])) / t))),
  );
  const tint = tints.find((tt) => tt.gradient_top.replace("#", "").toLowerCase() === hex);
  calibration[hex] = out;
  console.log(
    `  ${(tint?.code ?? "?").padEnd(9)} ${base.join(",").padEnd(12)} -> ${out.join(",").padEnd(14)}` +
    `  (t=${t.toFixed(2)}, n=${rows.length})`,
  );
}

/**
 * Compounded with the scale already in force, not replacing it.
 *
 * The solid fit reads the colour the generator actually used and so is
 * idempotent, but this one measures a residual ratio against output already
 * carrying the previous scale. Writing that ratio straight back undoes the
 * correction it was measured through.
 */
const gradientScale = median(gradientScales) == null
  ? null
  : median(gradientScales) * (PREVIOUS._gradient_scale ?? 1);
if (gradientScale) {
  calibration._gradient_scale = Number(gradientScale.toFixed(4));
  console.log(`
  gradient density scale: ${gradientScale.toFixed(3)} (from ${SPEC_FAITHFUL.join(", ")}, n=${gradientScales.length})`);
}

if (write) {
  fs.writeFileSync(OUT, JSON.stringify(calibration, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
} else {
  console.log("\n(dry run - pass --write to save)");
}
