import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Gem, Trash2 } from "lucide-react";

import { BeadForm } from "@/components/admin/BeadForm";
import { Button } from "@/components/ui/button";
import { formatLibraryPriceRange } from "@/features/bracelet/library-sizes";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { BeadSavePerf } from "@/features/admin/lib/bead-save-pipeline";
import {
  notifyAdminCreated,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
  notifyAdminSavedEdit,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useAdminListQuery } from "@/features/admin/hooks/useAdminListQuery";
import { useAdminResourceEditor } from "@/features/admin/hooks/useAdminResourceEditor";
import { ADMIN_QUERY } from "@/features/admin/routing";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";

import { LoadingState } from "@/components/common";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { AdminListPagination } from "../../components/AdminListPagination";
import { beadMatchesLibrarySearch } from "@/lib/bead-library-search";

type DeleteState = {
  beadId: string;
  designCount: number;
  itemCount: number;
};

export function BeadsAdminPage() {
  const { currencyCode } = useFormatCurrency();
  const cat = useCatalogue();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const editor = useAdminResourceEditor("beads");

  const typeFilter = searchParams.get(ADMIN_QUERY.typeId) ?? "all";
  const subTypeFilter = searchParams.get(ADMIN_QUERY.subBeadTypeId) ?? "all";

  const setTypeFilter = (value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "all") params.delete(ADMIN_QUERY.typeId);
        else params.set(ADMIN_QUERY.typeId, value);
        params.delete(ADMIN_QUERY.subBeadTypeId);
        params.delete(ADMIN_QUERY.page);
        return params;
      },
      { replace: true },
    );
  };

  const setSubTypeFilter = (value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "all") params.delete(ADMIN_QUERY.subBeadTypeId);
        else params.set(ADMIN_QUERY.subBeadTypeId, value);
        params.delete(ADMIN_QUERY.page);
        return params;
      },
      { replace: true },
    );
  };

  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReadyId, setDetailReadyId] = useState<string | null>(null);

  const statusLabelByCode = useMemo(
    () => new Map(cat.beadAvailabilityStatuses.map((s) => [s.code, s.label])),
    [cat.beadAvailabilityStatuses],
  );

  const filtered = useMemo(() => {
    return cat.beadLibraries.filter((b) => {
      if (typeFilter !== "all" && b.beadTypeId !== typeFilter) return false;
      if (subTypeFilter !== "all" && b.subBeadTypeId !== subTypeFilter) return false;
      return true;
    });
  }, [cat.beadLibraries, typeFilter, subTypeFilter]);

  const subTypesForFilter = useMemo(
    () =>
      typeFilter === "all"
        ? cat.subBeadTypes
        : cat.subBeadTypes.filter((s) => s.beadTypeId === typeFilter),
    [cat.subBeadTypes, typeFilter],
  );

  const list = useAdminListQuery(filtered, (b, q) => beadMatchesLibrarySearch(b, q));

  const editingEntry = useMemo(() => {
    if (!editor.itemId) return null;
    return cat.beadLibraries.find((b) => b.id === editor.itemId) ?? null;
  }, [cat.beadLibraries, editor.itemId]);

  useEffect(() => {
    if (!editor.isEditing || !editor.itemId) {
      setDetailReadyId(null);
      setDetailLoading(false);
      return;
    }
    const id = editor.itemId;
    let cancelled = false;
    setDetailLoading(true);
    setDetailReadyId(null);
    void cat
      .ensureBeadLibraryDetail(id)
      .then(() => {
        if (!cancelled) setDetailReadyId(id);
      })
      .catch((err) => {
        console.error("Failed to load bead library detail:", err);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cat, editor.isEditing, editor.itemId]);

  // Invalid deep link → return to list (wait until catalogue has loaded).
  useEffect(() => {
    if (
      editor.isEditing &&
      !editingEntry &&
      cat.beadLibraries.length > 0 &&
      !cat.isHydrating &&
      !detailLoading
    ) {
      editor.close();
    }
  }, [editor, editingEntry, cat.beadLibraries.length, cat.isHydrating, detailLoading]);

  const editorDetailReady =
    editor.isCreating || (editor.isEditing && detailReadyId === editor.itemId && Boolean(editingEntry));

  const modalOpen = editor.isOpen;
  useAdminEditorScroll(scrollRef, modalOpen ? { type: "edit" as const, entry: editingEntry ?? { id: "new" } } : null, [
    typeFilter,
    subTypeFilter,
  ]);

  const typeName = (beadTypeId: string) => cat.beadTypes.find((t) => t.id === beadTypeId)?.name ?? "—";
  const subTypeName = (subBeadTypeId: string) =>
    cat.subBeadTypes.find((s) => s.id === subBeadTypeId)?.name ?? "—";
  const defaultTypeId = typeFilter !== "all" ? typeFilter : undefined;
  const defaultSubTypeId = subTypeFilter !== "all" ? subTypeFilter : undefined;

  const availabilityLabel = (bead: BeadLibraryEntry) => {
    const code = bead.availabilityStatusCode ?? (bead.isActive === false ? "INACTIVE" : "ACTIVE");
    return statusLabelByCode.get(code) ?? code;
  };

  const requestDelete = async (beadId: string) => {
    try {
      const refs = await cat.getBeadLibraryReferences(beadId);
      setDeleteState({ beadId, designCount: refs.designCount, itemCount: refs.itemCount });
    } catch (err) {
      notifyAdminDeleteFailed(err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    setDeleteLoading(true);
    try {
      await cat.deleteBeadLibrary(deleteState.beadId, { force: true });
      if (editor.itemId === deleteState.beadId) editor.close();
      setDeleteState(null);
      notifyAdminDeleted("Bead");
    } catch (err) {
      notifyAdminDeleteFailed(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={modalOpen}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search beads…"
        onAdd={modalOpen ? undefined : editor.openCreate}
        addLabel="Add bead"
        onBack={modalOpen ? editor.close : undefined}
        title={
          modalOpen
            ? editor.isCreating
              ? "New bead"
              : "Edit bead"
            : "Bead library"
        }
        trailing={
          !modalOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="all">All types</option>
                {cat.beadTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={subTypeFilter}
                onChange={(e) => setSubTypeFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="all">All sub-types</option>
                {subTypesForFilter.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <AdminPage scrollRef={scrollRef} footer={`${filtered.length} bead(s)`}>
        {editor.isEditing && detailLoading ? (
          <LoadingState label="Loading bead crop data…" className="min-h-[240px]" />
        ) : editorDetailReady ? (
          <BeadForm
            key={editor.isCreating ? "new" : `edit-${editingEntry!.id}-${detailReadyId}`}
            initial={editor.isEditing ? editingEntry! : undefined}
            defaultBeadTypeId={defaultTypeId}
            defaultSubBeadTypeId={defaultSubTypeId}
            onCancel={editor.close}
            onSave={async (entry, sizes: BeadLibrarySizeInput[]) => {
              const perf = new BeadSavePerf();
              const mode = editor.isCreating ? "add" : "edit";
              try {
                let saved: BeadLibraryEntry;
                if (mode === "add") {
                  saved = await perf.measure("create", () => cat.addBeadLibrary(entry, sizes));
                  notifyAdminCreated("Bead");
                  editor.openEdit(saved.id);
                } else {
                  const initialSizes = sizesForLibrary(cat.beadLibrarySizes, editingEntry!.id).map(
                    (offer) => ({
                      sizeMm: offer.sizeMm,
                      unitPrice: offer.unitPrice,
                      isDefault: offer.isDefault,
                    }),
                  );
                  saved = await perf.measure("save", () =>
                    cat.saveBeadLibraryEntry(entry, sizes, {
                      initial: editingEntry!,
                      initialSizes,
                    }),
                  );
                  notifyAdminSavedEdit();
                  void saved;
                }
                perf.finish(mode === "add" ? "Bead create" : "Bead save");
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState icon={Gem} title="No beads" description="Add items to the unified bead library." />
        ) : (
          <>
            <ul className="space-y-1">
              {list.items.map((b) => (
                <AdminListRow
                  key={b.id}
                  onClick={() => editor.openEdit(b.id)}
                  onMouseEnter={() => {
                    void cat.ensureBeadLibraryDetail(b.id);
                  }}
                  actions={
                    deleteState?.beadId === b.id ? (
                      <AdminDeleteConfirm
                        label="Force delete this bead?"
                        confirmLabel={deleteLoading ? "Deleting…" : "Force Delete"}
                        message={
                          deleteState.designCount > 0
                            ? `This bead is currently used in ${deleteState.designCount} saved design${deleteState.designCount === 1 ? "" : "s"}. Force deleting it will remove it from the catalogue. Users opening those designs will be prompted to replace the missing bead.`
                            : "This will permanently delete the bead and all associated assets."
                        }
                        onCancel={() => setDeleteState(null)}
                        onConfirm={confirmDelete}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void requestDelete(b.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )
                  }
                >
                  {b.image ? (
                    <img
                      src={b.image}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-border/50 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeName(b.beadTypeId)} · {subTypeName(b.subBeadTypeId ?? "")} ·{" "}
                      {formatLibraryPriceRange(cat.beadLibrarySizes, b.id, currencyCode)}
                      {b.cropStatus === "ready" ? " · Ready" : " · Draft"}
                    </p>
                  </div>
                  {(b.availabilityStatusCode ?? "ACTIVE") !== "ACTIVE" ? (
                    <AdminStatusBadge label={availabilityLabel(b)} variant="danger" />
                  ) : null}
                </AdminListRow>
              ))}
            </ul>
            <AdminListPagination
              page={list.page}
              totalPages={list.totalPages}
              totalItems={list.totalItems}
              pageSize={list.pageSize}
              onPageChange={list.setPage}
            />
          </>
        )}
      </AdminPage>
    </div>
  );
}
