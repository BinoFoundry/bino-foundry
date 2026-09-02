#!/usr/bin/env node
/**
 * Full backup of the Supabase project — every table as JSON, plus every
 * storage object. Uses SUPABASE_SERVICE_ROLE_KEY from the repo-root .env,
 * so it needs no database password and no paid plan.
 *
 *   node scripts/backup-supabase.mjs [outDir] [--tables-only]
 *
 * Default outDir: ../bino-foundry-backups/<timestamp> (outside the repo, so a
 * backup can never be committed).
 *
 * The output contains password hashes, session tokens and encrypted SMTP
 * credentials. Treat the folder as a secret: keep it off shared drives and
 * out of any git repository.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = 1000;

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) throw new Error(`No .env at ${file}`);
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const URL_BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const args = process.argv.slice(2);
const tablesOnly = args.includes("--tables-only");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? path.join(ROOT, "..", "bino-foundry-backups", stamp));

async function getJson(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url.replace(URL_BASE, "")}`);
  return r.json();
}

/** Every table PostgREST exposes, from its OpenAPI spec. */
async function listTables() {
  const spec = await getJson(`${URL_BASE}/rest/v1/`);
  return Object.keys(spec.paths ?? {})
    .filter((p) => p.length > 1 && !p.includes("{") && !p.startsWith("/rpc/"))
    .map((p) => p.slice(1))
    .sort();
}

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
      headers: { ...H, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function listBucketFiles(bucket, prefix = "") {
  const found = [];
  for (let offset = 0; ; offset += PAGE) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!r.ok) throw new Error(`list ${bucket}/${prefix}: ${r.status}`);
    const page = await r.json();
    for (const item of page) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // A folder placeholder has no id; recurse into it.
      if (item.id === null) found.push(...(await listBucketFiles(bucket, full)));
      else found.push({ path: full, size: item.metadata?.size ?? 0 });
    }
    if (page.length < PAGE) break;
  }
  return found;
}

const human = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

(async () => {
  fs.mkdirSync(path.join(outDir, "tables"), { recursive: true });
  console.log(`Backing up ${URL_BASE}\n  → ${outDir}\n`);

  const tables = await listTables();
  const summary = { startedAt: new Date().toISOString(), supabaseUrl: URL_BASE, tables: {}, buckets: {} };
  let totalRows = 0;

  for (const t of tables) {
    try {
      const rows = await dumpTable(t);
      fs.writeFileSync(path.join(outDir, "tables", `${t}.json`), JSON.stringify(rows, null, 2));
      summary.tables[t] = rows.length;
      totalRows += rows.length;
      console.log(`  ${t.padEnd(34)} ${String(rows.length).padStart(6)} rows`);
    } catch (err) {
      summary.tables[t] = `ERROR: ${err.message}`;
      console.error(`  ${t.padEnd(34)} FAILED — ${err.message}`);
    }
  }

  if (!tablesOnly) {
    const buckets = await getJson(`${URL_BASE}/storage/v1/bucket`);
    console.log("");
    for (const b of buckets) {
      const files = await listBucketFiles(b.name);
      const bytes = files.reduce((s, f) => s + f.size, 0);
      console.log(`  bucket ${b.name.padEnd(12)} ${String(files.length).padStart(5)} files  ${human(bytes)}`);
      let ok = 0;
      for (const f of files) {
        const dest = path.join(outDir, "storage", b.name, f.path);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const r = await fetch(`${URL_BASE}/storage/v1/object/${b.name}/${f.path}`, { headers: H });
        if (!r.ok) { console.error(`    ! ${f.path} — ${r.status}`); continue; }
        fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
        ok++;
        if (ok % 250 === 0) console.log(`    …${ok}/${files.length}`);
      }
      summary.buckets[b.name] = { files: files.length, downloaded: ok, bytes };
    }
  }

  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(summary, null, 2));
  console.log(`\nDone. ${tables.length} tables, ${totalRows} rows → ${outDir}`);
  console.log("This folder contains password hashes and session tokens — keep it private.");
})().catch((err) => {
  console.error("\nBackup failed:", err.message);
  process.exit(1);
});
