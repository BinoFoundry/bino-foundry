/**
 * Stage generated tint plates into the builder's prototype folder.
 *
 *   node scripts/generate-tinted-plates.mjs --out .tmp-gen
 *   node scripts/stage-tint-proto.mjs .tmp-gen
 *
 * Copies every plate into frontend/public/tint-proto with a `gen-` prefix and
 * rewrites the `generated` half of tint-proto-manifest.json, which the builder
 * reads for each plate's dimensions. The `yours` half — hand-retouched
 * references — is left as it is.
 *
 * The image folder is ignored by git: 240 plates come to ~185MB and are fully
 * reproducible from the generator, the database and scripts/clear-lens.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2] ?? ".tmp-gen";
const dst = "frontend/public/tint-proto";
const manifestPath = "frontend/src/render/components/tint-proto-manifest.json";

if (!fs.existsSync(src)) {
  console.error(`no such folder: ${src}`);
  process.exit(1);
}
fs.mkdirSync(dst, { recursive: true });

const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { yours: {}, generated: {} };

const generated = {};
for (const file of fs.readdirSync(src)) {
  if (!file.endsWith(".png")) continue;
  const meta = await sharp(path.join(src, file)).metadata();
  fs.copyFileSync(path.join(src, file), path.join(dst, `gen-${file}`));
  // <slug>-<view>-<hex>.png, where the slug itself may contain dashes.
  const parts = file.replace(/\.png$/, "").split("-");
  const hex = parts.pop();
  const view = parts.pop();
  const slug = parts.join("-");
  generated[`${slug}|${view}|${hex}`] = { file: `gen-${file}`, w: meta.width, h: meta.height };
}

manifest.generated = Object.fromEntries(Object.entries(generated).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`staged ${Object.keys(generated).length} generated plate(s); ${Object.keys(manifest.yours ?? {}).length} hand-made reference(s) kept`);
