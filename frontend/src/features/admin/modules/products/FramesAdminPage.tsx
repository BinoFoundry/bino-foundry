import { useEffect, useMemo, useRef, useState } from "react";
import { Glasses, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { FrameEntry } from "@/data/glasses";
import { formatApiErrorMessage, isApiError } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";

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

type ModalState = { type: "add" } | { type: "edit"; frame: FrameEntry } | null;

export function FramesAdminPage() {
  const cat = useCatalogue();
  const { format } = useFormatCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const frames = cat.frames ?? [];
  const list = useAdminList(frames, (f, q) => f.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  const modalTitle = useMemo(() => {
    if (!modal) return "Frames";
    return modal.type === "add" ? "New frame" : "Edit frame";
  }, [modal]);

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
              key={modal.type === "add" ? "new" : modal.frame.id}
              initial={modal.type === "edit" ? modal.frame : undefined}
              onCancel={() => setModal(null)}
              onSave={async (entry) => {
                try {
                  if (modal.type === "add") {
                    await cat.addFrame(entry);
                  } else {
                    await cat.updateFrame(entry);
                    await cat.refreshFromApi();
                  }
                  setModal(null);
                } catch (err) {
                  alert(formatApiErrorMessage(err));
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
                return (
                  <AdminListRow
                    key={f.id}
                    onClick={() => setModal({ type: "edit", frame: f })}
                    actions={
                      list.isDeleting(f.id) ? (
                        <AdminDeleteConfirm
                          onCancel={list.cancelDelete}
                          onConfirm={async () => {
                            try {
                              await cat.deleteFrame(f.id);
                              list.cancelDelete();
                            } catch (err) {
                              alert(isApiError(err) ? err.message : "Failed to delete frame");
                            }
                          }}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => list.requestDelete(f.id)}
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
                        {format(f.price)} · clip {FRAME_CLIP_LABELS[clip].toLowerCase()}
                      </p>
                    </div>
                    {f.isActive === false ? (
                      <AdminStatusBadge label="Unpublished" variant="danger" />
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
