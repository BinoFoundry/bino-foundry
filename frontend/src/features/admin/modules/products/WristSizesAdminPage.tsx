import { useMemo, useRef, useState } from "react";
import { CircleDot, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/state/catalogue";
import type { WristSizeEntry } from "@/types/wrist-sizes";
import {
  notifyAdminCreated,
  notifyAdminSavedEdit,
  notifyAdminSaveFailed,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useAdminResourceEditor } from "@/features/admin/hooks/useAdminResourceEditor";
import {
  ADMIN_UNSAVED_COPY,
  useAdminUnsavedChangesContext,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "@/features/admin/unsaved-changes";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminActiveInactiveStatusField } from "../../components/AdminActiveInactiveStatusField";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";
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
  const [saving, setSaving] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const sizeRef = useRef<HTMLInputElement>(null);

  const dirtySnapshot = useMemo(
    () => ({ sizeCm, label, order, active, isDefault, notes }),
    [sizeCm, label, order, active, isDefault, notes],
  );
  const { isDirty, markClean } = useDirtySnapshot(dirtySnapshot, initial?.id ?? "new");
  const { confirmLeave } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (sizeCm < 1 || sizeCm > 50) {
      setSizeError("Enter a wrist size between 1 and 50 cm.");
      sizeRef.current?.focus();
      return;
    }
    setSizeError(null);
    setSaving(true);
    try {
      await onSave({
        sizeCm,
        label: label.trim(),
        displayOrder: order,
        isActive: active,
        isDefault,
        notes: notes.trim() || null,
      });
      markClean();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mx-auto max-w-md space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Size (cm)</label>
        <input
          ref={sizeRef}
          type="number"
          min={1}
          max={50}
          step={0.5}
          value={sizeCm}
          onChange={(e) => {
            setSizeCm(Number(e.target.value));
            setSizeError(null);
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-invalid={sizeError ? true : undefined}
        />
        {sizeError ? <p className="mt-1 text-xs text-destructive">{sizeError}</p> : null}
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
      <AdminActiveInactiveStatusField
        value={active}
        onChange={setActive}
        hint="Inactive sizes are hidden from the bracelet builder."
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default selection
      </label>
      <div className="flex justify-end gap-2 pt-2">
        {isDirty ? (
          <p className="mr-auto self-center text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => confirmLeave(onCancel)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function WristSizesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const editor = useAdminResourceEditor("wrist-sizes");
  const { confirmLeave } = useAdminUnsavedChangesContext();
  const list = useAdminList(cat.wristSizes, (s, q) => s.label.toLowerCase().includes(q));
  const editingEntry = useMemo(() => {
    if (!editor.itemId) return null;
    return cat.wristSizes.find((s) => s.id === editor.itemId) ?? null;
  }, [cat.wristSizes, editor.itemId]);

  useAdminEditorScroll(
    scrollRef,
    editor.isOpen ? { type: "edit" as const, entry: editingEntry ?? { id: "new" } } : null,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={editor.isOpen}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search wrist sizes…"
        onAdd={editor.isOpen ? undefined : editor.openCreate}
        addLabel="Add wrist size"
        onBack={editor.isOpen ? () => confirmLeave(editor.close) : undefined}
        title={
          editor.isOpen
            ? editor.isCreating
              ? "New wrist size"
              : "Edit wrist size"
            : "Wrist sizes"
        }
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.wristSizes.length} wrist size option(s)`}>
        {editor.isCreating || (editor.isEditing && editingEntry) ? (
          <WristSizeForm
            key={editor.isCreating ? "new" : editingEntry!.id}
            initial={editingEntry ?? undefined}
            onCancel={editor.close}
            onSave={async (entry) => {
              try {
                if (editor.isCreating) {
                  const saved = await cat.addWristSize(entry);
                  notifyAdminCreated("Wrist size");
                  editor.openEdit(saved.id);
                } else {
                  await cat.updateWristSize({ ...editingEntry!, ...entry });
                  notifyAdminSavedEdit();
                }
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
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
                onClick={() => editor.openEdit(s.id)}
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
