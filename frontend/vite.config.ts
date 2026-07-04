import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: path.resolve(__dirname, ".."),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bino-foundry/shared": path.resolve(__dirname, "../shared/src"),
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
}));
