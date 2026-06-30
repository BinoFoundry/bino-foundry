import { useState } from "react";

import { Button } from "@/components/ui/button";
import { strandRenderMigrationApi } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";

interface StrandRenderMigrationAdminProps {
  embedded?: boolean;
}

export function StrandRenderMigrationAdmin({ embedded = false }: StrandRenderMigrationAdminProps) {
  const cat = useCatalogue();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, success: (result: unknown) => string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      await cat.refreshFromApi();
      setMessage(success(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={embedded ? "space-y-3" : "mx-auto max-w-2xl space-y-3 p-4"}>
      {!embedded ? <h2 className="type-h2 text-lg">Rendering migration tools</h2> : null}
      <p className="text-xs text-muted-foreground">
        Bulk utilities for the hierarchical rendering system. Safe to re-run — only fills missing type
        defaults and removes redundant per-bead overrides.
      </p>
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy != null}
          onClick={() =>
            void run("init", () => strandRenderMigrationApi.initializeMissingTypes(), (r) => {
              const stats = r as { typesInitialized: number; typesSkipped: number };
              return `Initialized ${stats.typesInitialized} bead type(s); ${stats.typesSkipped} already configured.`;
            })
          }
        >
          {busy === "init" ? "Initializing…" : "Initialize missing type defaults"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy != null}
          onClick={() =>
            void run("cleanup", () => strandRenderMigrationApi.cleanupLibraryOverrides(), (r) => {
              const stats = r as { librariesCleaned: number; librariesSkipped: number };
              return `Cleaned ${stats.librariesCleaned} bead override(s); ${stats.librariesSkipped} unchanged.`;
            })
          }
        >
          {busy === "cleanup" ? "Cleaning…" : "Clean redundant bead overrides"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy != null}
          onClick={() =>
            void run("reset-all", () => strandRenderMigrationApi.resetLibrariesToType(), (r) => {
              const stats = r as { updated: number };
              return `Reset ${stats.updated} bead(s) to inherit their bead type defaults.`;
            })
          }
        >
          {busy === "reset-all" ? "Resetting…" : "Reset all beads to type defaults"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy != null}
          onClick={() =>
            void run("refresh", () => cat.refreshFromApi().then(() => ({})), () => "Catalogue cache refreshed.")
          }
        >
          {busy === "refresh" ? "Refreshing…" : "Rebuild rendering cache"}
        </Button>
      </div>
    </div>
  );
}
