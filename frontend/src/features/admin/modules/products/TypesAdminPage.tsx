import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TypeEntry } from "@/types/catalogue";
import { useCatalogue } from "@/state/catalogue";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { TypeForm } from "../../forms";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState = { type: "add" } | { type: "edit"; entry: TypeEntry } | null;

export function TypesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const list = useAdminList(cat.types ?? [], (t, q) => t.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  const closeModal = () => setModal(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search types…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add type"
        onBack={modal ? closeModal : undefined}
        title={
          modal ? (
            <h3 className="font-display text-lg font-semibold">
              {modal.type === "add" ? "New type" : "Edit type"}
            </h3>
          ) : undefined
        }
        trailing={
          modal?.type === "edit" ? (
            list.confirmDeleteId === modal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={list.cancelDelete}
                onConfirm={() => {
                  cat.deleteType(modal.entry.id);
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

      <AdminPage footer={<span>{(cat.types?.length ?? 0)} types</span>}>
        <div ref={scrollRef}>
          {modal ? (
            <TypeForm
              key={modal.type === "add" ? "add" : modal.entry.id}
              initial={modal.type === "edit" ? modal.entry : undefined}
              onSave={(e) => {
                if (modal.type === "add") cat.addType(e);
                else cat.updateType(e);
                closeModal();
              }}
              onCancel={closeModal}
            />
          ) : list.items.length === 0 ? (
            <AdminEmptyState />
          ) : (
            <div className="space-y-1">
              {list.items.map((t) => (
                <AdminListRow key={t.id} onClick={() => setModal({ type: "edit", entry: t })}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{t.id}</p>
                    {t.description ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
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
