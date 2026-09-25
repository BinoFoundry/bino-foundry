import { useEffect, useRef, useState } from "react";

import { NormalizedRegenProgressPanel } from "@/features/admin/components/NormalizedRegenProgressPanel";
import {
  runRefreshBeadAssetsJob,
  type NormalizedRegenJobProgress,
} from "@/features/admin/lib/normalized-asset-regen";
import { useCatalogue } from "@/state/catalogue";

const IDLE: NormalizedRegenJobProgress = {
  status: "idle",
  done: 0,
  total: 0,
  saved: 0,
  reference: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
  succeeded: 0,
  currentLabel: null,
  etaMs: null,
  errorMessage: null,
  summary: null,
};

declare global {
  interface Window {
    __BEAD_ASSET_REFRESH__?: {
      status: string;
      progress: NormalizedRegenJobProgress | null;
      error?: string;
    };
  }
}

/**
 * Dev-only auto-runner for the same pipeline as Admin → Bead sizes → Refresh bead assets.
 * Used by scripts/refresh-bead-assets.mjs (Playwright). Not registered in production builds.
 */
export default function DevRefreshBeadAssetsPage() {
  const cat = useCatalogue();
  const [progress, setProgress] = useState<NormalizedRegenJobProgress>(IDLE);
  const started = useRef(false);
  const force =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("force") === "1";

  useEffect(() => {
    window.__BEAD_ASSET_REFRESH__ = { status: "waiting-catalogue", progress: null };
  }, []);

  useEffect(() => {
    if (cat.isHydrating || started.current) return;
    if (cat.hydrateError) {
      window.__BEAD_ASSET_REFRESH__ = {
        status: "failed",
        progress: null,
        error: cat.hydrateError,
      };
      return;
    }
    if (cat.beadLibraries.length === 0 && cat.beadLibrarySizes.length === 0) {
      window.__BEAD_ASSET_REFRESH__ = {
        status: "failed",
        progress: null,
        error: "Catalogue empty — check API URL and network",
      };
      return;
    }

    started.current = true;
    window.__BEAD_ASSET_REFRESH__ = { status: "running", progress: IDLE };

    void runRefreshBeadAssetsJob(
      {
        beadLibraries: cat.beadLibraries,
        beadLibrarySizes: cat.beadLibrarySizes,
        beadSizes: cat.beadSizes,
        beadTypes: cat.beadTypes,
        recalculateMmGroupReferences: cat.recalculateMmGroupReferences,
        refreshBeadLibrarySizes: cat.refreshBeadLibrarySizes,
      },
      {
        force,
        onProgress: (p) => {
          setProgress(p);
          window.__BEAD_ASSET_REFRESH__ = { status: p.status, progress: p };
        },
      },
    )
      .then(async ({ regen }) => {
        await cat.refreshBeadLibrarySizes();
        setProgress(regen);
        window.__BEAD_ASSET_REFRESH__ = { status: regen.status, progress: regen };
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const failed: NormalizedRegenJobProgress = {
          ...IDLE,
          status: "failed",
          errorMessage: message,
        };
        setProgress(failed);
        window.__BEAD_ASSET_REFRESH__ = { status: "failed", progress: failed, error: message };
      });
  }, [cat]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="type-h2 text-lg">Dev — refresh bead assets</h1>
      <p className="text-sm text-muted-foreground">
        Runs the Bead sizes “Refresh bead assets” pipeline (hydrate crops → recalculate size groups →
        regenerate normalized exports). Leave this tab open until it finishes.
      </p>
      {progress.status !== "idle" ? <NormalizedRegenProgressPanel progress={progress} /> : null}
      <pre className="overflow-auto rounded-md bg-muted p-3 text-[11px]">
        {JSON.stringify(
          {
            status: progress.status,
            done: progress.done,
            total: progress.total,
            saved: progress.saved,
            failed: progress.failed,
            skipped: progress.skipped,
            unchanged: progress.unchanged,
            errorMessage: progress.errorMessage,
            summary: progress.summary,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
