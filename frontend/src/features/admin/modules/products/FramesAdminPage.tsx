import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FrameEntry } from "@/data/glasses";
import { isApiError } from "@/services/api";
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

export function FramesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const frames = cat.frames ?? [];
  const list = useAdminList(frames, (f, q) => f.name.toLowerCase().includes(q));

  const selectedFrame =
    selectedId && selectedId !== "new" ? frames.find((f) => f.id === selectedId) : undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedId, isEditing]);

  const clearSelection = () => {
    setSelectedId(null);
    setIsEditing(false);
    setConfirmDeleteId(null);
  };

  const showList = !selectedId;
  const isNew = selectedId === "new";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!showList}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search frames…"
        onAdd={showList ? () => { setSelectedId("new"); setIsEditing(true); } : undefined}
        addLabel="Add frame"
        onBack={selectedId ? () => {
          if (isEditing && !isNew) setIsEditing(false);
          else clearSelection();
        } : undefined}
        title={
          selectedId ? (
            <FrameToolbarTitle frame={selectedFrame} isNew={isNew} isEditing={isEditing} />
          ) : undefined
        }
        trailing={
          selectedFrame && !isEditing ? (
            confirmDeleteId === selectedFrame.id ? (
              <AdminDeleteConfirm
                onCancel={() => setConfirmDeleteId(null)}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteFrame(selectedFrame.id);
                      clearSelection();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete frame");
                    }
                  })();
                }}
              />
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDeleteId(selectedFrame.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )
          ) : undefined
        }
      />

      <AdminPage footer={<span>{frames.length} frame{frames.length === 1 ? "" : "s"}{list.totalItems !== frames.length ? ` · ${list.totalItems} shown` : ""}</span>}>
        <div ref={scrollRef} className="mx-auto w-full max-w-4xl">
          {isNew || (selectedFrame && isEditing) ? (
            <FrameForm
              key={isNew ? "new" : selectedFrame!.id}
              initial={isNew ? undefined : selectedFrame}
              onSave={async (entry) => {
                try {
                  if (isNew) await cat.addFrame(entry);
                  else await cat.updateFrame(entry);
                  if (isNew) clearSelection();
                  else setIsEditing(false);
                } catch (err) {
                  const msg = isApiError(err)
                    ? err.details
                      ? `${err.message}\n${JSON.stringify(err.details, null, 2)}`
                      : err.message
                    : "Failed to save frame";
                  alert(msg);
                  throw err;
                }
              }}
              onCancel={() => {
                if (isNew) clearSelection();
                else setIsEditing(false);
              }}
            />
          ) : selectedFrame ? (
            <FrameDetailView frame={selectedFrame} />
          ) : list.items.length === 0 ? (
            <AdminEmptyState message="No frames found." />
          ) : (
            <>
              <div className="space-y-1">
                {list.items.map((f) => {
                  const clip = summarizeFrameClipStatus(f.renderViews);
                  return (
                    <AdminListRow key={f.id} onClick={() => { setSelectedId(f.id); setIsEditing(false); }}>
                      <FrameThumb frame={f} />
                      <div className="min-w-0 flex-1">
                        <p className="type-body truncate font-medium">{f.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{f.id}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <AdminStatusBadge
                          label={FRAME_CLIP_LABELS[clip]}
                          variant={clip === "ready" ? "success" : clip === "draft" ? "warning" : "muted"}
                        />
                        {f.isActive === false ? (
                          <AdminStatusBadge label="Unpublished" variant="danger" />
                        ) : null}
                      </div>
                    </AdminListRow>
                  );
                })}
              </div>
              <AdminListPagination
                page={list.page}
                totalPages={list.totalPages}
                totalItems={list.totalItems}
                pageSize={list.pageSize}
                onPageChange={list.setPage}
              />
            </>
          )}
        </div>
      </AdminPage>
    </div>
  );
}

function FrameToolbarTitle({
  frame,
  isNew,
  isEditing,
}: {
  frame?: FrameEntry;
  isNew: boolean;
  isEditing: boolean;
}) {
  if (isNew) {
    return (
      <div>
        <h3 className="type-h3">New frame</h3>
        <p className="type-small text-muted-foreground">Add a sunglasses style</p>
      </div>
    );
  }
  if (!frame) return null;
  return (
    <div className="flex items-center gap-3">
      <FrameThumb frame={frame} size="lg" />
      <div>
        <h3 className="type-h3">{frame.name}</h3>
        <p className="text-sm text-muted-foreground">
          ${frame.price} · {frame.id}
          {frame.isActive === false ? " · unpublished" : ""}
          {isEditing ? " · editing" : ""}
        </p>
      </div>
    </div>
  );
}

function FrameThumb({ frame, size = "sm" }: { frame: FrameEntry; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const src =
    frame.renderViews?.find((v) => v.view === "front")?.plateUrl ?? frame.frameImages?.[0];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${dim} shrink-0 rounded bg-muted/50 object-contain`}
        crossOrigin="anonymous"
      />
    );
  }
  return (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded bg-muted/50 text-xl`}>
      👓
    </div>
  );
}

function FrameDetailView({ frame }: { frame: FrameEntry }) {
  const clip = summarizeFrameClipStatus(frame.renderViews);
  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap gap-2">
        <AdminStatusBadge
          label={FRAME_CLIP_LABELS[clip]}
          variant={clip === "ready" ? "success" : clip === "draft" ? "warning" : "muted"}
        />
        <AdminStatusBadge
          label={frame.isActive === false ? "Unpublished" : "Published"}
          variant={frame.isActive === false ? "danger" : "success"}
        />
        <span className="text-xs text-muted-foreground">Base price ${frame.price}</span>
      </div>
      <section>
        <h3 className="type-h3 mb-4">
          Render views ({frame.renderViews?.filter((v) => v.plateUrl).length ?? 0})
        </h3>
        {(frame.renderViews?.filter((v) => v.plateUrl).length ?? 0) === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
            No views configured. Click Edit to upload front/side plates and masks.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {frame.renderViews
              ?.filter((v) => v.plateUrl)
              .map((v) => (
                <div key={v.view} className="rounded-lg border border-border bg-background p-3">
                  <p className="mb-2 text-sm font-medium capitalize">
                    {v.view} · clip {v.clipStatus ?? v.maskStatus ?? "draft"}
                  </p>
                  <img
                    src={v.plateUrl}
                    alt={v.view}
                    className="mx-auto max-h-40 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

