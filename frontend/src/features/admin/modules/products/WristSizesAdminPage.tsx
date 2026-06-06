import { useEffect, useRef, useState } from "react";
import { CircleDot, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isApiError } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState = { type: "add" } | { type: "edit"; entry: WristSizeEntry } | null;

function WristSizeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: WristSizeEntry;
  onSave: (v: Omit<WristSizeEntry, "id" | "createdAt" | "updatedAt">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [sizeCm, setSizeCm] = useState(initial?.sizeCm ?? 16);
  const [label, setLabel] = useState(initial?.label ?? "16 cm");
  const [order, setOrder] = useState(initial?.displayOrder ?? 0);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          sizeCm,
          label: label.trim(),
          displayOrder: order,
          isActive: active,
          isDefault,
          notes: notes.trim() || null,
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Size (cm)</label>
        <input
          type="number"
          min={1}
          max={50}
          step={0.5}
          value={sizeCm}
          onChange={(e) => setSizeCm(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Display name</label>
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
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Notes (internal)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default selection
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

export function WristSizesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const list = useAdminList(cat.wristSizes, (s, q) => s.label.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search wrist sizes…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add wrist size"
        onBack={modal ? () => setModal(null) : undefined}
        title={modal ? (modal.type === "add" ? "New wrist size" : "Edit wrist size") : "Wrist sizes"}
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.wristSizes.length} wrist size option(s)`}>
        {modal ? (
          <WristSizeForm
            initial={modal.type === "edit" ? modal.entry : undefined}
            onCancel={() => setModal(null)}
            onSave={async (entry) => {
              try {
                if (modal.type === "add") await cat.addWristSize(entry);
                else await cat.updateWristSize({ ...modal.entry, ...entry });
                setModal(null);
              } catch (err) {
                alert(isApiError(err) ? err.message : "Save failed");
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState
            icon={CircleDot}
            title="No wrist sizes"
            description="Define wrist measurements customers choose before building a bracelet."
          />
        ) : (
          <ul className="space-y-1">
            {list.items.map((s) => (
              <AdminListRow
                key={s.id}
                onClick={() => setModal({ type: "edit", entry: s })}
                actions={
                  list.isDeleting(s.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        await cat.deleteWristSize(s.id);
                        list.cancelDelete();
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
                    {s.isDefault ? <span className="ml-2 text-[10px] text-primary">default</span> : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.sizeCm} cm · order {s.displayOrder ?? 0}
                    {s.isActive === false ? " · inactive" : ""}
                    {s.notes ? " · has notes" : ""}
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
