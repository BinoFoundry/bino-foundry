import { useEffect, useRef, useState } from "react";
import { Ruler, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { validateBeadSizeMm } from "@/lib/bead-size-mm";
import { isApiError } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";
import type { BeadSizeEntry } from "@/types/bead-sizes";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState = { type: "add" } | { type: "edit"; entry: BeadSizeEntry } | null;

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
  const [mult, setMult] = useState(initial?.priceMultiplier ?? 1);
  const [order, setOrder] = useState(initial?.displayOrder ?? 0);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const sizeError = validateBeadSizeMm(sizeMm);
        if (sizeError) {
          alert(sizeError);
          return;
        }
        void onSave({
          sizeMm,
          label: label.trim(),
          priceMultiplier: mult,
          displayOrder: order,
          isActive: active,
          isDefault,
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Size (mm)</label>
        <input
          type="number"
          step="any"
          value={sizeMm}
          onChange={(e) => setSizeMm(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
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
        <label className="mb-1 block text-xs text-muted-foreground">Price multiplier</label>
        <input
          type="number"
          min={0.1}
          max={10}
          step={0.05}
          value={mult}
          onChange={(e) => setMult(Number(e.target.value))}
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active in builder
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default size for new sessions
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

export function BeadSizesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const list = useAdminList(cat.beadSizes, (s, q) => s.label.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search sizes…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add size"
        onBack={modal ? () => setModal(null) : undefined}
        title={modal ? (modal.type === "add" ? "New bead size" : "Edit bead size") : "Bead sizes"}
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.beadSizes.length} size option(s)`}>
        {modal ? (
          <SizeForm
            initial={modal.type === "edit" ? modal.entry : undefined}
            onCancel={() => setModal(null)}
            onSave={async (entry) => {
              try {
                if (modal.type === "add") await cat.addBeadSize(entry);
                else await cat.updateBeadSize({ ...modal.entry, ...entry });
                setModal(null);
              } catch (err) {
                alert(isApiError(err) ? err.message : "Save failed");
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
                onClick={() => setModal({ type: "edit", entry: s })}
                actions={
                  list.isDeleting(s.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        await cat.deleteBeadSize(s.id);
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
                    {s.isDefault ? (
                      <span className="ml-2 text-[10px] text-primary">default</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.sizeMm} mm · ×{s.priceMultiplier.toFixed(2)}
                    {s.isActive === false ? " · inactive" : ""}
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
