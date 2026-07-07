import { useMemo, useRef, useState } from "react";
import { Glasses, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { FrameEntry } from "@/data/glasses";
import { useCatalogue } from "@/state/catalogue";
import {
  applyAdminSaveModalState,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
  type AdminEditorModalState,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";

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

type ModalState = AdminEditorModalState<FrameEntry>;

type DeleteState = {
  frameId: string;
  designCount: number;
  itemCount: number;
};

export function FramesAdminPage() {
  const cat = useCatalogue();
  const { format } = useFormatCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusLabelByCode = useMemo(
    () => new Map(cat.catalogAvailabilityStatuses.map((s) => [s.code, s.label])),
    [cat.catalogAvailabilityStatuses],
  );

  const frames = cat.frames ?? [];
  const list = useAdminList(frames, (f, q) => f.name.toLowerCase().includes(q));

  useAdminEditorScroll(scrollRef, modal);

  const modalTitle = useMemo(() => {
    if (!modal) return "Frames";
    return modal.type === "add" ? "New frame" : "Edit frame";
  }, [modal]);

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
      if (modal?.type === "edit" && modal.entry.id === deleteState.frameId) {
        setModal(null);
      }
      setDeleteState(null);
      notifyAdminDeleted("Frame");
    } catch (err) {
      notifyAdminDeleteFailed(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search frames…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add frame"
        onBack={modal ? () => setModal(null) : undefined}
        title={modalTitle}
      />

      <AdminPage
        scrollRef={scrollRef}
        footer={
          <span>
            {frames.length} frame{frames.length === 1 ? "" : "s"}
            {list.totalItems !== frames.length ? ` · ${list.totalItems} shown` : ""}
          </span>
        }
      >
        {modal ? (
          <div className="mx-auto w-full max-w-4xl">
            <FrameForm
              key={modal.type === "add" ? "new" : modal.entry.id}
              initial={modal.type === "edit" ? modal.entry : undefined}
              onCancel={() => setModal(null)}
              onSave={async (entry) => {
                const mode = modal.type;
                try {
                  const saved =
                    mode === "add" ? await cat.addFrame(entry) : await cat.updateFrame(entry);
                  applyAdminSaveModalState(mode, saved, setModal, { createdLabel: "Frame" });
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
                    onClick={() => setModal({ type: "edit", entry: f })}
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
                        {format(f.price)} · clip {FRAME_CLIP_LABELS[clip].toLowerCase()} ·{" "}
                        {availabilityLabel(f)}
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
