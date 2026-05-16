import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FrameEntry } from "@/data/glasses";
import { useCatalogue } from "@/state/catalogue";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { FrameForm } from "../../forms";
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
                  cat.deleteFrame(selectedFrame.id);
                  clearSelection();
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

      <AdminPage footer={<span>{frames.length} frame{frames.length === 1 ? "" : "s"}</span>}>
        <div ref={scrollRef} className="mx-auto w-full max-w-4xl">
          {isNew || (selectedFrame && isEditing) ? (
            <FrameForm
              key={isNew ? "new" : selectedFrame!.id}
              initial={isNew ? undefined : selectedFrame}
              onSave={(entry) => {
                if (isNew) cat.addFrame(entry);
                else cat.updateFrame(entry);
                if (isNew) clearSelection();
                else setIsEditing(false);
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
            <div className="space-y-1">
              {list.items.map((f) => (
                <AdminListRow key={f.id} onClick={() => { setSelectedId(f.id); setIsEditing(false); }}>
                  <FrameThumb frame={f} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{f.id}</p>
                  </div>
                </AdminListRow>
              ))}
            </div>
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
        <h3 className="font-display text-lg font-semibold">New frame</h3>
        <p className="text-sm text-muted-foreground">Add a sunglasses style</p>
      </div>
    );
  }
  if (!frame) return null;
  return (
    <div className="flex items-center gap-3">
      <FrameThumb frame={frame} size="lg" />
      <div>
        <h3 className="font-display text-lg font-semibold">{frame.name}</h3>
        <p className="text-sm text-muted-foreground">
          ${frame.price} · {frame.id}
          {isEditing ? " · editing" : ""}
        </p>
      </div>
    </div>
  );
}

function FrameThumb({ frame, size = "sm" }: { frame: FrameEntry; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const src = frame.frameImages?.[0];
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
  return (
    <div className="space-y-8 pb-8">
      <section>
        <h3 className="mb-4 text-lg font-semibold">Images ({frame.frameImages?.length ?? 0})</h3>
        <AssetGrid
          items={(frame.frameImages ?? []).map((src, i) => ({
            key: String(i),
            src,
            label: src.split("/").pop() ?? `Image ${i + 1}`,
          }))}
          emptyLabel="No frame images. Click Edit to add."
        />
      </section>
      <section className="border-t border-border pt-6">
        <h3 className="mb-4 text-lg font-semibold">Lens colours ({frame.lensColors?.length ?? 0})</h3>
        <AssetGrid
          items={(frame.lensColors ?? []).map((lc, i) => ({
            key: String(i),
            src: lc.image,
            label: lc.colorName || `Colour ${i + 1}`,
          }))}
          emptyLabel="No lens colours configured. Click Edit to add."
        />
      </section>
    </div>
  );
}

function AssetGrid({
  items,
  emptyLabel,
}: {
  items: { key: string; src?: string; label: string }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background p-3 text-center shadow-sm"
        >
          {item.src ? (
            <img
              src={item.src}
              alt=""
              className="h-24 w-full rounded object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex h-24 w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
              No image
            </div>
          )}
          <span className="w-full truncate px-1 text-sm font-medium" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
