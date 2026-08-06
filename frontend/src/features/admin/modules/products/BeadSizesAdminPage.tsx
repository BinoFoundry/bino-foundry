import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Ruler, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NormalizedRegenProgressPanel } from "@/features/admin/components/NormalizedRegenProgressPanel";
import { useAdminDeveloperMode } from "@/features/admin/lib/developer-mode";
import {
  notifyAdminCreated,
  notifyAdminSavedEdit,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useAdminResourceEditor } from "@/features/admin/hooks/useAdminResourceEditor";
import {
  runRefreshBeadAssetsJob,
  type NormalizedRegenJobProgress,
} from "@/features/admin/lib/normalized-asset-regen";
import {
  ADMIN_UNSAVED_COPY,
  useAdminUnsavedChangesContext,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "@/features/admin/unsaved-changes";
import { formatBeadSizeMm } from "@/lib/bead-size-format";
import { validateBeadSizeMm } from "@/lib/bead-size-mm";
import { formatApiErrorMessage } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";
import type { BeadSizeEntry } from "@/types/bead-sizes";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminActiveInactiveStatusField } from "../../components/AdminActiveInactiveStatusField";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";

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

function SizeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BeadSizeEntry;
  onSave: (v: Omit<BeadSizeEntry, "id" | "createdAt" | "updatedAt">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [sizeMm, setSizeMm] = useState(initial?.sizeMm ?? 8);
  const [label, setLabel] = useState(initial?.label ?? "8 mm");
  const [order, setOrder] = useState(initial?.displayOrder ?? 0);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const sizeRef = useRef<HTMLInputElement>(null);

  const dirtySnapshot = useMemo(
    () => ({ sizeMm, label, order, active, isDefault }),
    [sizeMm, label, order, active, isDefault],
  );
  const { isDirty, markClean } = useDirtySnapshot(dirtySnapshot, initial?.id ?? "new");
  const { confirmLeave, clearDirtySync } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const validationError = validateBeadSizeMm(sizeMm);
    if (validationError) {
      setSizeError(validationError);
      sizeRef.current?.focus();
      return;
    }
    setSizeError(null);
    setSaving(true);
    try {
      markClean();
      clearDirtySync();
      await onSave({
        sizeMm,
        label: formatBeadSizeMm(sizeMm),
        displayOrder: order,
        isActive: active,
        isDefault,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mx-auto max-w-md space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Size (mm)</label>
        <input
          ref={sizeRef}
          type="number"
          step="any"
          value={sizeMm}
          onChange={(e) => {
            const next = Number(e.target.value);
            setSizeMm(next);
            setLabel(formatBeadSizeMm(next));
            setSizeError(null);
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-invalid={sizeError ? true : undefined}
        />
        {sizeError ? <p className="mt-1 text-xs text-destructive">{sizeError}</p> : null}
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Display order</label>
        <input
          type="number"
          min={0}
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <AdminActiveInactiveStatusField
        value={active}
        onChange={setActive}
        hint="Inactive sizes are hidden from the bracelet builder."
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default size for new sessions
      </label>
      <p className="text-[10px] text-muted-foreground">
        Pricing is set per bead under Bead library → Available sizes, not here.
      </p>
      <div className="flex justify-end gap-2">
        {isDirty ? (
          <p className="mr-auto self-center text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => confirmLeave(onCancel)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function BeadSizesAdminPage() {
  const cat = useCatalogue();
  const developerMode = useAdminDeveloperMode();
  const editor = useAdminResourceEditor("bead-sizes");
  const { confirmLeave } = useAdminUnsavedChangesContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<NormalizedRegenJobProgress>(IDLE_PROGRESS);
  const list = useAdminList(cat.beadSizes, (s, q) => s.label.toLowerCase().includes(q));

  const editingEntry = useMemo(() => {
    if (!editor.itemId) return null;
    return cat.beadSizes.find((s) => s.id === editor.itemId) ?? null;
  }, [cat.beadSizes, editor.itemId]);

  useEffect(() => {
    if (editor.isEditing && !editingEntry && cat.beadSizes.length > 0 && !cat.isHydrating) {
      editor.close();
    }
  }, [editor, editingEntry, cat.beadSizes.length, cat.isHydrating]);

  const jobRunning = progress.status === "preparing" || progress.status === "running";
  const regenCtx = {
    beadLibraries: cat.beadLibraries,
    beadLibrarySizes: cat.beadLibrarySizes,
    beadSizes: cat.beadSizes,
    beadTypes: cat.beadTypes,
    recalculateMmGroupReferences: cat.recalculateMmGroupReferences,
    refreshBeadLibrarySizes: cat.refreshBeadLibrarySizes,
  };

  useAdminEditorScroll(
    scrollRef,
    editor.isOpen ? { type: "edit" as const, entry: editingEntry ?? { id: "new" } } : null,
  );

  const cancelJob = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={editor.isOpen}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search sizes…"
        onAdd={editor.isOpen ? undefined : editor.openCreate}
        addLabel="Add size"
        onBack={editor.isOpen ? () => confirmLeave(editor.close) : undefined}
        title={
          editor.isOpen
            ? editor.isCreating
              ? "New bead size"
              : "Edit bead size"
            : "Bead sizes"
        }
        trailing={
          !editor.isOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refreshing || jobRunning}
                className="text-xs"
                title="Update bead assets after changing crops or bead sizes"
                onClick={() => {
                  abortRef.current?.abort();
                  const controller = new AbortController();
                  abortRef.current = controller;
                  setRefreshing(true);
                  setProgress({ ...IDLE_PROGRESS, status: "preparing", phase: "preparing" });

                  void runRefreshBeadAssetsJob(regenCtx, {
                    signal: controller.signal,
                    onProgress: setProgress,
                  })
                    .then(async ({ regen }) => {
                      await cat.refreshBeadLibrarySizes();
                      setProgress(regen);
                    })
                    .catch((err) => {
                      setProgress({
                        ...IDLE_PROGRESS,
                        status: "failed",
                        errorMessage: formatApiErrorMessage(err),
                      });
                    })
                    .finally(() => {
                      abortRef.current = null;
                      setRefreshing(false);
                    });
                }}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh bead assets
              </Button>
              {jobRunning ? (
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={cancelJob}>
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.beadSizes.length} size option(s)`}>
        {!editor.isOpen && progress.status !== "idle" ? (
          <div className="mb-4">
            <NormalizedRegenProgressPanel progress={progress} />
          </div>
        ) : null}

        {!editor.isOpen ? (
          <p className="mb-4 text-xs text-muted-foreground">
            After changing crops or bead sizes, use <span className="font-medium">Refresh bead assets</span> to
            update optimized images across the catalogue.
          </p>
        ) : null}

        {editor.isCreating || (editor.isEditing && editingEntry) ? (
          <SizeForm
            key={editor.isCreating ? "new" : editingEntry!.id}
            initial={editingEntry ?? undefined}
            onCancel={editor.close}
            onSave={async (entry) => {
              try {
                if (editor.isCreating) {
                  const saved = await cat.addBeadSize(entry);
                  notifyAdminCreated("Bead size");
                  void cat.recalculateMmGroupReferences().catch((err) => {
                    notifyAdminSaveFailed(err, "Saved, but reference recalculation failed.");
                  });
                  editor.openEdit(saved.id);
                } else {
                  const sizeMmChanged = editingEntry!.sizeMm !== entry.sizeMm;
                  await cat.updateBeadSize({ ...editingEntry!, ...entry });
                  notifyAdminSavedEdit();
                  if (sizeMmChanged) {
                    void cat.recalculateMmGroupReferences().catch((err) => {
                      notifyAdminSaveFailed(err, "Saved, but reference recalculation failed.");
                    });
                  }
                }
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState
            icon={Ruler}
            title="No bead sizes"
            description="Define the mm options customers can choose in the bracelet builder."
          />
        ) : (
          <ul className="space-y-1">
            {list.items.map((s) => (
              <AdminListRow
                key={s.id}
                onClick={() => editor.openEdit(s.id)}
                actions={
                  list.isDeleting(s.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        try {
                          await cat.deleteBeadSize(s.id);
                          list.cancelDelete();
                          if (editor.itemId === s.id) editor.close();
                          notifyAdminDeleted("Bead size");
                        } catch (err) {
                          notifyAdminDeleteFailed(err);
                        }
                      }}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => list.requestDelete(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {s.label}
                    {s.isDefault ? (
                      <span className="ml-2 text-[10px] text-primary">default</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.sizeMm} mm{s.isActive === false ? " · inactive" : ""}
                    {developerMode && s.groupReferenceDiameterPx != null
                      ? ` · ref ${Math.round(s.groupReferenceDiameterPx)} px`
                      : ""}
                  </p>
                </div>
              </AdminListRow>
            ))}
          </ul>
        )}
      </AdminPage>
    </div>
  );
}
