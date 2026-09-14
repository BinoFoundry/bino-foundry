/**
 * Cut contact sheets of tinted frames into one transparent PNG per frame + view.
 *
 * The catalogue exports several frames per sheet, each labelled, and on some
 * sheets a front row above a side row. Producing 20 individual cut-outs per
 * colour by hand is the slow part; this does it from whatever sheets exist.
 *
 *   node scripts/slice-tinted-sheets.mjs "<folder>" [--out <dir>] [--dry]
 *
 * The tint hex comes from the folder or filename (e.g. "#5A0000"). The frame
 * codes come from the filename ("PK009 008 007"), which fixes *which* frames are
 * on the sheet but not the order they appear in — these exports are frequently
 * out of order. So each cut-out is matched by silhouette against the catalogue's
 * own reference images, and the best one-to-one assignment across the whole
 * sheet is chosen. Constraining each frame to appear once is what makes this
 * reliable: several of these frames differ by only a few percent on their own.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const srcDir = args.find((a) => !a.startsWith("--"));
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : "tinted-output";
const dryRun = args.includes("--dry");
if (!srcDir) {
  console.error("usage: node scripts/slice-tinted-sheets.mjs <folder> [--out <dir>] [--dry]");
  process.exit(1);
}

/** Pixels this close to white are background; the ramp between keeps soft shadows. */
const BG_CLEAR = 250;
const BG_SOLID = 220;
/** A band of ink only counts as a product row at this fraction of sheet height. */
const MIN_PRODUCT_ROW = 0.18;
const PAD = 12;
/** Silhouette raster size used for identification. */
const SIL = 200;

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const norm = (code) => {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c === "PK8018" || c === "PK8018S" ? "pk8018-s" : c.toLowerCase();
};

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

function inkMap({ data, w, h, ch }) {
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (data[i + 3] < 24) continue;
      if (luma(data[i], data[i + 1], data[i + 2]) < BG_CLEAR - 4) ink[y * w + x] = 1;
    }
  }
  return ink;
}

function runs(projection, minLen) {
  const out = [];
  let start = -1;
  for (let i = 0; i < projection.length; i++) {
    const on = projection[i] > 0;
    if (on && start < 0) start = i;
    if ((!on || i === projection.length - 1) && start >= 0) {
      const end = on ? i : i - 1;
      if (end - start + 1 >= minLen) out.push([start, end]);
      start = -1;
    }
  }
  return out;
}

/**
 * Split a band into exactly `count` columns by cutting at the widest gaps.
 * Frames on these sheets sometimes sit only a dozen pixels apart, so a fixed
 * gap threshold merges them; knowing how many to expect avoids guessing.
 */
function splitColumns(ink, w, y0, y1, count) {
  const proj = new Array(w).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) proj[x]++;
  const filled = runs(proj, 3);
  if (!filled.length) return [];
  const first = filled[0][0];
  const last = filled[filled.length - 1][1];
  const gaps = [];
  for (let i = 1; i < filled.length; i++) {
    gaps.push({ at: filled[i - 1][1], to: filled[i][0], width: filled[i][0] - filled[i - 1][1] });
  }
  gaps.sort((a, b) => b.width - a.width);
  const cuts = gaps.slice(0, Math.max(0, count - 1)).sort((a, b) => a.at - b.at);
  const cols = [];
  let start = first;
  for (const g of cuts) {
    cols.push([start, g.at]);
    start = g.to;
  }
  cols.push([start, last]);
  return cols;
}

function bbox(ink, w, x0, x1, y0, y1) {
  let a = 1e9, b = 1e9, c = -1, d = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!ink[y * w + x]) continue;
      if (x < a) a = x;
      if (x > c) c = x;
      if (y < b) b = y;
      if (y > d) d = y;
    }
  }
  return c < 0 ? null : [a, b, c, d];
}

/** True when the export already carries its own alpha, so nothing needs keying. */
async function alreadyCutOut(file) {
  const { data, w, h, ch } = await raw(file);
  const at = (x, y) => data[(y * w + x) * ch + 3];
  return [at(3, 3), at(w - 4, 3), at(3, h - 4), at(w - 4, h - 4)].every((a) => a < 24);
}

/**
 * Crop a cell, keying white to transparency only when the source needs it.
 *
 * Keying by luminance is fine for the white-background contact sheets but wrong
 * for exports that already have an alpha channel: a pale frame sits in the same
 * luminance band as the background, so the cream acetate models were being
 * dissolved along with it.
 */
async function cutOut(file, [x0, y0, x1, y1], w, h, keyWhite = true) {
  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  const width = Math.min(w - left, x1 - x0 + 1 + PAD * 2);
  const height = Math.min(h - top, y1 - y0 + 1 + PAD * 2);
  const { data, info } = await sharp(file)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  if (keyWhite) {
    for (let p = 0; p < info.width * info.height; p++) {
      const i = p * ch;
      const l = luma(data[i], data[i + 1], data[i + 2]);
      const alpha =
        l >= BG_CLEAR ? 0
        : l <= BG_SOLID ? 255
        : Math.round(((BG_CLEAR - l) / (BG_CLEAR - BG_SOLID)) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}

async function silhouette(input) {
  const { data, w, h, ch } = await raw(input);
  const solid = (x, y) => {
    const i = (y * w + x) * ch;
    return data[i + 3] >= 40 && luma(data[i], data[i + 1], data[i + 2]) < 205;
  };
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const m = new Uint8Array(SIL * SIL);
  for (let j = 0; j < SIL; j++) {
    for (let i = 0; i < SIL; i++) {
      const x = Math.round(x0 + (i / (SIL - 1)) * (x1 - x0));
      const y = Math.round(y0 + (j / (SIL - 1)) * (y1 - y0));
      m[j * SIL + i] = solid(x, y) ? 1 : 0;
    }
  }
  return m;
}

const iou = (a, b) => {
  let inter = 0;
  let uni = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] | b[k]) uni++;
    if (a[k] & b[k]) inter++;
  }
  return uni ? inter / uni : 0;
};

/**
 * Reference silhouettes from the catalogue's own per-frame sheets (PK002.png …),
 * which sit one level above the tinted folders. Same photography as the tinted
 * exports, so they discriminate far better than the cropped live plates do.
 */
async function referenceShapes(catalogueDir) {
  const refs = new Map();
  const labels = new Map();
  for (const file of fs.readdirSync(catalogueDir).filter((f) => /^PK[\w-]*\.png$/i.test(f))) {
    const slug = norm(path.basename(file, path.extname(file)));
    const sheet = await raw(path.join(catalogueDir, file));
    const ink = inkMap(sheet);
    const proj = new Array(sheet.h).fill(0);
    for (let y = 0; y < sheet.h; y++) {
      for (let x = 0; x < sheet.w; x++) if (ink[y * sheet.w + x]) proj[y]++;
    }
    const allBands = runs(proj, 4);
    const bands = allBands.filter(([a, b]) => (b - a) / sheet.h >= 0.10);
    if (bands.length < 2) continue;
    // The title block above the product is the frame's own printed name and size
    // code — the same glyphs the contact sheets carry, so it identifies a column
    // far more sharply than the frame outline, several of which are near-identical.
    const titleBand = allBands.find((b) => b[1] < bands[0][0]);
    if (titleBand) {
      const tb = bbox(ink, sheet.w, 0, sheet.w - 1, titleBand[0], titleBand[1]);
      if (tb) labels.set(slug, await silhouette(await cutOut(path.join(catalogueDir, file), tb, sheet.w, sheet.h)));
    }
    const byHeight = [...bands].sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])).slice(0, 2);
    byHeight.sort((p, q) => p[0] - q[0]);
    for (const [axis, band] of [["front", byHeight[0]], ["side", byHeight[1]]]) {
      const box = bbox(ink, sheet.w, 0, sheet.w - 1, band[0], band[1]);
      if (!box) continue;
      const buf = await cutOut(path.join(catalogueDir, file), box, sheet.w, sheet.h);
      refs.set(`${slug}|${axis}`, await silhouette(buf));
    }
  }
  return { refs, labels };
}

/** Best one-to-one assignment of cut-outs to the frames named on the sheet. */
function bestAssignment(cells, slugs, refs, labels, axis) {
  const score = cells.map((c) => slugs.map((s) => {
    const ref = refs.get(`${s}|${axis}`);
    const shape = ref && c.sil ? iou(c.sil, ref) : 0;
    const lab = labels.get(s);
    const label = lab && c.label ? iou(c.label, lab) : null;
    // Weight the printed label heavily; the outline only breaks ties.
    return label === null ? shape : label * 3 + shape;
  }));
  let best = null;
  const permute = (chosen, used) => {
    if (chosen.length === cells.length) {
      const total = chosen.reduce((sum, si, ci) => sum + score[ci][si], 0);
      if (!best || total > best.total) best = { total, order: [...chosen] };
      return;
    }
    for (let s = 0; s < slugs.length; s++) {
      if (used.has(s)) continue;
      used.add(s);
      chosen.push(s);
      permute(chosen, used);
      chosen.pop();
      used.delete(s);
    }
  };
  permute([], new Set());
  const labelOnly = cells.map((c) => slugs.map((s) => {
    const lab = labels.get(s);
    return lab && c.label ? iou(c.label, lab) : 0;
  }));
  return { order: best?.order ?? [], score, labelOnly };
}

const hexFrom = (s) => (/#\s*([0-9A-Fa-f]{6})/.exec(s) || [])[1]?.toLowerCase() ?? null;
const codesFrom = (name) => {
  const head = name.split("#")[0];
  const found = head.match(/PK\s*\d+(?:-?S)?|(?<=\s)\d{3,4}\b/gi) ?? [];
  return found.map((c) => norm(c.startsWith("PK") || c.startsWith("pk") ? c : `PK${c}`));
};

const catalogueDir = path.resolve(srcDir, "..");
const files = fs.readdirSync(srcDir).filter((f) => /\.png$/i.test(f));
if (!files.length) {
  console.error("no PNGs in", srcDir);
  process.exit(1);
}
const folderHex = hexFrom(path.basename(srcDir));

console.log(`Reading ${files.length} sheet(s) from ${srcDir}`);
const { refs, labels } = await referenceShapes(catalogueDir);
console.log(`Reference shapes from ${catalogueDir}: ${refs.size / 2} frames, ${labels.size} labels
`);
if (!dryRun) fs.mkdirSync(outDir, { recursive: true });

const written = [];
let lowConfidence = 0;
for (const file of files) {
  const full = path.join(srcDir, file);
  const hex = hexFrom(file) ?? folderHex;
  const slugs = codesFrom(file);
  if (!hex) { console.log(`SKIP ${file} — no tint hex in the filename or folder`); continue; }
  if (!slugs.length) { console.log(`SKIP ${file} — no frame codes in the filename`); continue; }

  const sheet = await raw(full);
  const keyWhite = !(await alreadyCutOut(full));
  const ink = inkMap(sheet);
  const proj = new Array(sheet.h).fill(0);
  for (let y = 0; y < sheet.h; y++) {
    for (let x = 0; x < sheet.w; x++) if (ink[y * sheet.w + x]) proj[y]++;
  }
  const allBands = runs(proj, 4);
  const bands = allBands.filter(([a, b]) => (b - a) / sheet.h >= MIN_PRODUCT_ROW);
  const labelBand = bands.length ? allBands.find((b) => b[1] < bands[0][0]) : null;
  const named = /FRONT\s+SIDE/i.test(file) ? null
    : /SIDE/i.test(file) ? "side"
    : /FRONT/i.test(file) ? "front"
    : null;

  console.log(`${file}\n  ${slugs.length} frame(s), ${bands.length} product row(s), tint #${hex}`);

  for (let bi = 0; bi < bands.length; bi++) {
    const [y0, y1] = bands[bi];
    const axis = bands.length > 1 ? (bi === 0 ? "front" : "side") : named ?? "front";
    const cols = splitColumns(ink, sheet.w, y0, y1, slugs.length);
    const cells = [];
    for (const [cx0, cx1] of cols) {
      const box = bbox(ink, sheet.w, cx0, cx1, y0, y1);
      if (!box) continue;
      const buf = await cutOut(full, box, sheet.w, sheet.h, keyWhite);
      let label = null;
      if (labelBand) {
        const lb = bbox(ink, sheet.w, cx0, cx1, labelBand[0], labelBand[1]);
        if (lb) label = await silhouette(await cutOut(full, lb, sheet.w, sheet.h, keyWhite));
      }
      cells.push({ buf, sil: await silhouette(buf), label });
    }
    const { order, score, labelOnly } = bestAssignment(cells, slugs, refs, labels, axis);
    cells.forEach((cell, ci) => {
      const slug = slugs[order[ci]];
      const confidence = labelOnly[ci]?.[order[ci]] ?? 0;
      const name = `${slug}-${axis}-${hex}.png`;
      // One frame named on the sheet leaves nothing to choose between, and the
      // single-frame exports carry no printed label to score against either.
      const forced = slugs.length === 1;
      const weak = !forced && confidence < 0.80;
      if (weak) lowConfidence++;
      const score = forced ? "only frame on the sheet" : `label ${(confidence * 100).toFixed(1)}%`;
      console.log(
        `    col ${ci + 1} ${axis.padEnd(5)} -> ${name.padEnd(26)} ${score}` +
        (weak ? "   << low confidence, check this one" : ""),
      );
      if (!dryRun) {
        fs.writeFileSync(path.join(outDir, name), cell.buf);
        written.push(name);
      }
    });
  }
  console.log("");
}

if (!dryRun) {
  const dupes = [...new Set(written.filter((n, i) => written.indexOf(n) !== i))];
  console.log(`Wrote ${written.length} file(s) to ${outDir}`);
  if (dupes.length) console.log(`Overwritten by a duplicate assignment: ${dupes.join(", ")}`);
}
if (lowConfidence) console.log(`${lowConfidence} cut-out(s) matched below 85% — worth eyeballing.`);
