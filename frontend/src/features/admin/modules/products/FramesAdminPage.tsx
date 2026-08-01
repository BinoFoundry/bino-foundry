import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Glasses, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { FrameEntry } from "@/data/glasses";
import { useCatalogue } from "@/state/catalogue";
import {
  notifyAdminCreated,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
  notifyAdminSavedEdit,
} from "@/features/admin/lib/admin-save-feedback";
import { buildFrameDuplicateSeed } from "@/features/admin/lib/frame-duplicate";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useAdminResourceEditor } from "@/features/admin/hooks/useAdminResourceEditor";
import { ADMIN_QUERY, adminResourcePath, withAdminSearch } from "@/features/admin/routing";

import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import {
  FRAME_CLIP_LABELS,
  summarizeFrameClipStatus,
} from "../../lib/frameClipStatus";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { FrameForm } from "../../forms";
import { AdminListPagination } from "../../components/AdminListPagination";
import { useAdminList } from "../../hooks/useAdminList";

type DeleteState = {
  frameId: string;
  designCount: number;
  itemCount: number;
};

export function FramesAdminPage() {
  const cat = useCatalogue();
  const { format } = useFormatCurrency();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const editor = useAdminResourceEditor("frames");
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const familyFilter = searchParams.get(ADMIN_QUERY.family) ?? "all";
  const dupFromId = searchParams.get("dup");

  const setFamilyFilter = (value: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "all") params.delete(ADMIN_QUERY.family);
        else params.set(ADMIN_QUERY.family, value);
        params.delete(ADMIN_QUERY.page);
        return params;
      },
      { replace: true },
    );
  };

  const statusLabelByCode = useMemo(
    () => new Map(cat.catalogAvailabilityStatuses.map((s) => [s.code, s.label])),
    [cat.catalogAvailabilityStatuses],
  );

  const frames = cat.frames ?? [];
  const familyOptions = useMemo(
    () =>
      [...new Set(frames.map((f) => f.modelFamily?.trim()).filter((v): v is string => Boolean(v)))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [frames],
  );
  const filteredFrames = useMemo(() => {
    if (familyFilter === "all") return frames;
    if (familyFilter === "none") return frames.filter((f) => !f.modelFamily?.trim());
    return frames.filter((f) => f.modelFamily?.trim() === familyFilter);
  }, [frames, familyFilter]);
  const list = useAdminList(filteredFrames, (f, q) => {
    const query = q.toLowerCase();
    return (
      f.name.toLowerCase().includes(query) ||
      Boolean(f.modelFamily?.toLowerCase().includes(query))
    );
  });

  const editingEntry = useMemo(() => {
    if (!editor.itemId) return null;
    return frames.find((f) => f.id === editor.itemId) ?? null;
  }, [frames, editor.itemId]);

  const duplicateSeed = useMemo(() => {
    if (!editor.isCreating || !dupFromId) return undefined;
    const source = frames.find((f) => f.id === dupFromId);
    return source ? buildFrameDuplicateSeed(source) : undefined;
  }, [editor.isCreating, dupFromId, frames]);

  useEffect(() => {
    if (editor.isEditing && !editingEntry && frames.length > 0 && !cat.isHydrating) {
      editor.close();
    }
  }, [editor, editingEntry, frames.length, cat.isHydrating]);

  const modalOpen = editor.isOpen;
  useAdminEditorScroll(
    scrollRef,
    modalOpen ? { type: "edit" as const, entry: editingEntry ?? { id: "new" } } : null,
  );

  const modalTitle = useMemo(() => {
    if (!modalOpen) return "Frames";
    if (editor.isEditing) return "Edit frame";
    return duplicateSeed ? "Duplicate frame" : "New frame";
  }, [modalOpen, editor.isEditing, duplicateSeed]);

  const openDuplicate = (frame: FrameEntry) => {
    const params = new URLSearchParams(searchParams);
    params.set("dup", frame.id);
    navigate(withAdminSearch(adminResourcePath("frames", "new"), params.toString()));
    toast.message(`Duplicated “${frame.name}”. Review and save to create the new SKU.`);
  };

  const availabilityLabel = (frame: FrameEntry) => {
    const code = frame.availabilityStatusCode ?? (frame.isActive === false ? "INACTIVE" : "ACTIVE");
    return statusLabelByCode.get(code) ?? code;
  };

  const requestDelete = async (frameId: string) => {
    try {
      const refs = await cat.getFrameReferences(frameId);
      setDeleteState({ frameId, designCount: refs.designCount, itemCount: refs.itemCount });
    } catch (err) {
      notifyAdminDeleteFailed(err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    setDeleteLoading(true);
    try {
      await cat.deleteFrame(deleteState.frameId, { force: true });
      if (editor.itemId === deleteState.frameId) editor.close();
      setDeleteState(null);
      notifyAdminDeleted("Frame");
    } catch (err) {
      notifyAdminDeleteFailed(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeEditor = () => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("dup");
        return params;
      },
      { replace: true },
    );
    editor.close();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={modalOpen}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search frames or family…"
        onAdd={modalOpen ? undefined : editor.openCreate}
        addLabel="Add frame"
        onBack={modalOpen ? closeEditor : undefined}
        title={modalTitle}
      />

      {!modalOpen && familyOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 sm:px-6">
          <label className="text-xs text-muted-foreground" htmlFor="frame-family-filter">
            Family
          </label>
          <select
            id="frame-family-filter"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
          >
            <option value="all">All families</option>
            <option value="none">No family</option>
            {familyOptions.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <AdminPage
        scrollRef={scrollRef}
        footer={
          <span>
            {frames.length} frame{frames.length === 1 ? "" : "s"}
            {list.totalItems !== frames.length ? ` · ${list.totalItems} shown` : ""}
          </span>
        }
      >
        {editor.isCreating || (editor.isEditing && editingEntry) ? (
          <div className="mx-auto w-full max-w-4xl">
            <FrameForm
              key={
                editor.isEditing
                  ? editingEntry!.id
                  : duplicateSeed
                    ? `dup-${duplicateSeed.name}`
                    : "new"
              }
              initial={editor.isEditing ? editingEntry! : duplicateSeed}
              onCancel={closeEditor}
              onSave={async (entry) => {
                try {
                  if (editor.isCreating) {
                    const saved = await cat.addFrame(entry);
                    notifyAdminCreated("Frame");
                    setSearchParams(
                      (prev) => {
                        const params = new URLSearchParams(prev);
                        params.delete("dup");
                        return params;
                      },
                      { replace: true },
                    );
                    editor.openEdit(saved.id);
                  } else {
                    await cat.updateFrame(entry);
                    notifyAdminSavedEdit();
                  }
                } catch (err) {
                  notifyAdminSaveFailed(err);
                  throw err;
                }
              }}
            />
          </div>
        ) : list.items.length === 0 ? (
          <AdminEmptyState
            icon={Glasses}
            title="No frames"
            description="Add sunglasses frame SKUs with front and side render views."
          />
        ) : (
          <>
            <ul className="space-y-1">
              {list.items.map((f) => {
                const clip = summarizeFrameClipStatus(f.renderViews);
                const frontPlate =
                  f.renderViews?.find((v) => v.view === "front")?.plateUrl ?? f.frameImages?.[0];
                const statusCode =
                  f.availabilityStatusCode ?? (f.isActive === false ? "INACTIVE" : "ACTIVE");
                return (
                  <AdminListRow
                    key={f.id}
                    onClick={() => editor.openEdit(f.id)}
                    actions={
                      deleteState?.frameId === f.id ? (
                        <AdminDeleteConfirm
                          label="Force delete this frame?"
                          confirmLabel={deleteLoading ? "Deleting…" : "Force Delete"}
                          message={
                            deleteState.designCount > 0
                              ? `This frame is currently used in ${deleteState.designCount} saved design${deleteState.designCount === 1 ? "" : "s"}. Force deleting it will permanently remove it from the catalogue. Users opening those designs will be prompted to replace the unavailable frame.`
                              : "This will permanently delete the frame and all associated assets."
                          }
                          onCancel={() => setDeleteState(null)}
                          onConfirm={confirmDelete}
                        />
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Duplicate frame"
                            aria-label={`Duplicate ${f.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDuplicate(f);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void requestDelete(f.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )
                    }
                  >
                    {frontPlate ? (
                      <img
                        src={frontPlate}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded border border-border/50 bg-muted/30 object-contain"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-sm">
                        👓
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(f.price)}
                        {f.modelFamily?.trim() ? ` · ${f.modelFamily.trim()}` : ""}
                        {" · clip "}
                        {FRAME_CLIP_LABELS[clip].toLowerCase()} · {availabilityLabel(f)}
                      </p>
                    </div>
                    {statusCode !== "ACTIVE" ? (
                      <AdminStatusBadge label={availabilityLabel(f)} variant="danger" />
                    ) : clip === "ready" ? (
                      <AdminStatusBadge label="Ready" variant="success" />
                    ) : null}
                  </AdminListRow>
                );
              })}
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
