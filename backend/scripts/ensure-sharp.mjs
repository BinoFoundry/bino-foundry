import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const require = createRequire(import.meta.url);

function canResolveSharp() {
  for (const base of [repoRoot, path.join(repoRoot, "backend")]) {
    try {
      require.resolve("sharp", { paths: [base] });
      return true;
    } catch {
      // try next base
    }
  }
  return false;
}

if (!canResolveSharp()) {
  console.log('==> "sharp" not found — installing backend dependency');
  execSync("npm install sharp@^0.35.3 -w @bino-foundry/backend", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (!canResolveSharp()) {
    console.error(
      [
        "",
        'Failed to install "sharp". From the repository root, run:',
        "",
        "  npm ci",
        "",
        "Then rebuild:",
        "",
        "  npm run build:all",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}
