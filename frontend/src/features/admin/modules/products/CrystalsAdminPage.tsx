import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CrystalEntry } from "@/data/crystals";
import { useCatalogue } from "@/state/catalogue";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { CrystalForm } from "../../forms";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState =
  | { type: "add" }
  | { type: "edit"; entry: CrystalEntry }
  | null;

export function CrystalsAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const list = useAdminList(cat.crystals, (c, q) => c.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  const closeModal = () => setModal(null);
  const editingId = modal?.type === "edit" ? modal.entry.id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search crystals…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add crystal"
        onBack={modal ? closeModal : undefined}
        title={
          modal ? (
            <div>
              <h3 className="font-display text-lg font-semibold">
                {modal.type === "add" ? "New crystal" : "Edit crystal"}
              </h3>
            </div>
          ) : undefined
        }
        trailing={
          modal?.type === "edit" ? (
            list.confirmDeleteId === modal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={list.cancelDelete}
                onConfirm={() => {
                  cat.deleteCrystal(modal.entry.id);
                  list.cancelDelete();
                  closeModal();
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => list.requestDelete(modal.entry.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )
          ) : undefined
        }
      />

      <AdminPage
        footer={
          <span>
            {cat.crystals.length} crystal{cat.crystals.length === 1 ? "" : "s"}
          </span>
        }
      >
        <div ref={scrollRef}>
          {modal ? (
            <CrystalForm
              key={modal.type === "add" ? "add" : modal.entry.id}
              initial={modal.type === "edit" ? modal.entry : undefined}
              onSave={(e) => {
                if (modal.type === "add") cat.addCrystal(e);
                else cat.updateCrystal(e);
                closeModal();
              }}
              onCancel={closeModal}
            />
          ) : list.items.length === 0 ? (
            <AdminEmptyState />
          ) : (
            <div className="space-y-1">
              {list.items.map((c) => (
                <AdminListRow
                  key={c.id}
                  selected={editingId === c.id}
                  onClick={() => setModal({ type: "edit", entry: c })}
                >
                  {c.image ? (
                    <img
                      src={c.image}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-border/50 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${c.price.toFixed(2)} / bead
                      {c.type
                        ? ` · ${cat.types?.find((t) => t.id === c.type)?.name ?? c.type}`
                        : ""}
                    </p>
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
