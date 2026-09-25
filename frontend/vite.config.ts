import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

import { resolveFrontendViteEnv } from "./vite-resolve-env";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const frontendDir = __dirname;
  const repoRoot = path.resolve(frontendDir, "..");
  const viteEnv = resolveFrontendViteEnv(mode, frontendDir);

  if (mode === "development") {
    // Safe diagnostics only — never print secret values.
    console.info(
      `[vite] catalogue auth key present: ${Boolean(viteEnv.VITE_ADMIN_API_KEY)} · api base set: ${Boolean(viteEnv.VITE_API_BASE_URL)}`,
    );
  }

  // Where the SPA is served from. Default "/" keeps local dev and any
  // root-hosted deploy working. The New Chapter storefront serves this app
  // under /design/, and sets BASE_PATH so assets are requested from there
  // rather than colliding with the storefront's own /assets. App.tsx reads the
  // same value back via import.meta.env.BASE_URL for the router basename — the
  // two must always agree or navigation breaks.
  const rawBase = process.env.BASE_PATH?.trim() || "/";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    // Root remains the primary envDir (ADMIN_API_KEY + shared VITE_* live there).
    // Additional frontend/.env* values are merged in resolveFrontendViteEnv.
    envDir: repoRoot,
    define: {
      // Ensure merged / mirrored values reach the SPA even when only set in one env file.
      "import.meta.env.VITE_ADMIN_API_KEY": JSON.stringify(viteEnv.VITE_ADMIN_API_KEY),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(viteEnv.VITE_API_BASE_URL),
      "import.meta.env.VITE_API_PREFIX": JSON.stringify(viteEnv.VITE_API_PREFIX),
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(viteEnv.VITE_BACKEND_URL),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": { target: "https://thenewchapterstudio.com", changeOrigin: true, secure: true },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(frontendDir, "./src"),
        "@bino-foundry/shared": path.resolve(repoRoot, "shared/src"),
      },
    },
    build: {
      // Keep peak RSS low on small VPS hosts (exit 137 = Linux OOM killer).
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1200,
      target: "es2020",
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@radix-ui") || id.includes("lucide-react")) return "ui";
            if (id.includes("@dnd-kit")) return "dnd";
            if (id.includes("@tanstack")) return "query";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("react-router")) {
              return "react-vendor";
            }
          },
        },
      },
    },
  };
});
