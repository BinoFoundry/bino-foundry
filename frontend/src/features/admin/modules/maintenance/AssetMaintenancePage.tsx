import { useCallback, useMemo, useRef, useState } from "react";
import { HardDrive, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { NormalizedRegenProgressPanel } from "@/features/admin/components/NormalizedRegenProgressPanel";
import {
  buildNormalizedRegenQueue,
  countNormalizedRegenWorkItems,
  hydrateBeadLibrariesForNormalizedRegen,
  runNormalizedAssetRegenJob,
  type NormalizedRegenFilter,
  type NormalizedRegenJobProgress,
  type NormalizedRegenScope,
} from "@/features/admin/lib/normalized-asset-regen";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";

import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";

const IDLE_PROGRESS: NormalizedRegenJobProgress = {
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

export function AssetMaintenancePage() {
  const cat = useCatalogue();
  const abortRef = useRef<AbortController | null>(null);

  const [scope, setScope] = useState<NormalizedRegenScope>("all");
  const [sizeMm, setSizeMm] = useState<number | "">("");
  const [beadTypeId, setBeadTypeId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [beadSearch, setBeadSearch] = useState("");
  const [progress, setProgress] = useState<NormalizedRegenJobProgress>(IDLE_PROGRESS);
  const [recalcFirst, setRecalcFirst] = useState(true);

  const filter = useMemo((): NormalizedRegenFilter => {
    const base: NormalizedRegenFilter = { scope, force: true, includeIneligible: true };
    if (scope === "bead-size" && sizeMm !== "") base.sizeMm = Number(sizeMm);
    if (scope === "category" && beadTypeId) base.beadTypeId = beadTypeId;
    if (scope === "selected") base.libraryIds = [...selectedIds];
    return base;
  }, [scope, sizeMm, beadTypeId, selectedIds]);

  const previewCount = useMemo(
    () =>
      countNormalizedRegenWorkItems(
        cat.beadLibraries,
        cat.beadLibrarySizes,
        cat.beadSizes,
        cat.beadTypes,
        filter,
      ),
    [cat.beadLibraries, cat.beadLibrarySizes, cat.beadSizes, cat.beadTypes, filter],
  );

  const selectableBeads = useMemo(() => {
    const q = beadSearch.trim().toLowerCase();
    return cat.beadLibraries
      .filter((b) => {
        if (!b.cropConfig) return false;
        if (!q) return true;
        return b.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cat.beadLibraries, beadSearch]);

  const running = progress.status === "preparing" || progress.status === "running";

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(selectableBeads.map((b) => b.id)));
  }, [selectableBeads]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const canStart =
    !running &&
    previewCount > 0 &&
    (scope !== "bead-size" || sizeMm !== "") &&
    (scope !== "category" || Boolean(beadTypeId)) &&
    (scope !== "selected" || selectedIds.size > 0);

  const startRegeneration = async () => {
    if (!canStart) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress({ ...IDLE_PROGRESS, status: "preparing", total: previewCount });

    try {
      setProgress((p) => ({ ...p, status: "preparing", currentLabel: "Loading crop data…" }));
      const hydratedLibraries = await hydrateBeadLibrariesForNormalizedRegen(cat.beadLibraries, {
        signal: controller.signal,
        onProgress: (done, total) => {
          setProgress((p) => ({
            ...p,
            status: "preparing",
            done,
            total,
            currentLabel: `Loading crop data… (${done}/${total})`,
          }));
        },
      });

      if (recalcFirst) {
        setProgress((p) => ({ ...p, status: "preparing", currentLabel: "Refreshing group references…" }));
        await cat.recalculateMmGroupReferences();
        await cat.refreshBeadLibrarySizes();
      }

      const items = buildNormalizedRegenQueue(
        hydratedLibraries,
        cat.beadLibrarySizes,
        cat.beadSizes,
        cat.beadTypes,
        filter,
      );

      const result = await runNormalizedAssetRegenJob({
        items,
        signal: controller.signal,
        onProgress: setProgress,
      });

      await cat.refreshBeadLibrarySizes();

      if (result.status === "completed") {
        setProgress(result);
      } else {
        setProgress(result);
      }
    } catch (err) {
      setProgress({
        ...IDLE_PROGRESS,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Regeneration failed",
      });
    } finally {
      abortRef.current = null;
    }
  };

  const cancelRegeneration = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar title="Asset maintenance" hideSearch />

      <AdminPage footer="Normalized export maintenance">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <h3 className="type-h3 text-base">Regenerate normalized assets</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Re-run the latest normalization algorithm on existing beads using each bead&apos;s
              approved crop polygon and original upload. Original files and crop metadata are never
              modified — only normalized exports are replaced.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground">Regeneration scope</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["all", "Regenerate all assets"],
                  ["bead-size", "Regenerate by bead size"],
                  ["category", "Regenerate by category"],
                  ["selected", "Regenerate selected assets"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="regen-scope"
                    checked={scope === value}
                    disabled={running}
                    onChange={() => setScope(value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {scope === "bead-size" ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Bead size (mm)</label>
                <select
                  value={sizeMm}
                  disabled={running}
                  onChange={(e) =>
                    setSizeMm(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select size…</option>
                  {cat.beadSizes.map((s) => (
                    <option key={s.id} value={s.sizeMm}>
                      {s.label} ({s.sizeMm} mm)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === "category" ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Bead category</label>
                <select
                  value={beadTypeId}
                  disabled={running}
                  onChange={(e) => setBeadTypeId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category…</option>
                  {cat.beadTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === "selected" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[12rem] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={beadSearch}
                      disabled={running}
                      onChange={(e) => setBeadSearch(e.target.value)}
                      placeholder="Search beads…"
                      className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={running}
                    onClick={selectAllVisible}
                  >
                    Select visible
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={running}
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
                  {selectableBeads.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No beads with saved crops.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {selectableBeads.map((bead) => (
                        <SelectableBeadRow
                          key={bead.id}
                          bead={bead}
                          checked={selectedIds.has(bead.id)}
                          disabled={running}
                          typeName={
                            cat.beadTypes.find((t) => t.id === bead.beadTypeId)?.name ?? "—"
                          }
                          sizeCount={sizesForLibrary(cat.beadLibrarySizes, bead.id).length}
                          onToggle={() => toggleSelected(bead.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {selectedIds.size} selected
                </p>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recalcFirst}
                disabled={running}
                onChange={(e) => setRecalcFirst(e.target.checked)}
              />
              Refresh size-group references before regenerating (recommended)
            </label>

            <p className="text-xs text-muted-foreground">
              {previewCount} normalized export{previewCount === 1 ? "" : "s"} will be processed
              {scope === "selected" && selectedIds.size === 0 ? " (select beads above)" : ""}.
            </p>
          </section>

          {progress.status !== "idle" ? (
            <NormalizedRegenProgressPanel progress={progress} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canStart} onClick={() => void startRegeneration()}>
              {running ? "Regenerating…" : "Start regeneration"}
            </Button>
            {running ? (
              <Button type="button" variant="outline" onClick={cancelRegeneration}>
                Cancel
              </Button>
            ) : null}
          </div>

          {cat.beadLibraries.length === 0 ? (
            <AdminEmptyState
              icon={HardDrive}
              title="No bead assets"
              description="Add beads to the library before running normalized export maintenance."
            />
          ) : null}
        </div>
      </AdminPage>
    </div>
  );
}

function SelectableBeadRow({
  bead,
  checked,
  disabled,
  typeName,
  sizeCount,
  onToggle,
}: {
  bead: BeadLibraryEntry;
  checked: boolean;
  disabled: boolean;
  typeName: string;
  sizeCount: number;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
        <span className="min-w-0 flex-1 truncate font-medium">{bead.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {typeName} · {sizeCount} size{sizeCount === 1 ? "" : "s"}
        </span>
      </label>
    </li>
  );
}
