import { useEffect, useRef, useState } from "react";
import { Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TypeForm } from "@/components/admin/TypeForm";
import { isApiError } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";
import type { BeadTypeEntry } from "@/types/beads";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState = { type: "add" } | { type: "edit"; entry: BeadTypeEntry } | null;

export function BeadTypesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const list = useAdminList(cat.beadTypes, (t, q) => t.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search bead types…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add type"
        onBack={modal ? () => setModal(null) : undefined}
        title={modal ? (modal.type === "add" ? "New bead type" : "Edit bead type") : "Bead types"}
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.beadTypes.length} type(s)`}>
        {modal ? (
          <TypeForm
            initial={
              modal.type === "edit"
                ? { id: modal.entry.id, name: modal.entry.name, description: modal.entry.description }
                : undefined
            }
            onCancel={() => setModal(null)}
            onSave={async (entry) => {
              try {
                if (modal.type === "add") {
                  await cat.addBeadType({ name: entry.name, description: entry.description });
                } else {
                  await cat.updateBeadType({
                    ...modal.entry,
                    name: entry.name,
                    description: entry.description,
                  });
                }
                setModal(null);
              } catch (err) {
                alert(isApiError(err) ? err.message : "Save failed");
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState icon={Settings2} title="No bead types" description="Define Crystal, Charm, Spacer, and custom categories." />
        ) : (
          <ul className="space-y-1">
            {list.items.map((t) => (
              <AdminListRow
                key={t.id}
                onClick={() => setModal({ type: "edit", entry: t })}
                actions={
                  list.isDeleting(t.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        await cat.deleteBeadType(t.id);
                        list.cancelDelete();
                      }}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => list.requestDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{t.slug}</p>
                  {t.description ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                  ) : null}
                </div>
              </AdminListRow>
            ))}
          </ul>
        )}
      </AdminPage>
    </div>
  );
}
