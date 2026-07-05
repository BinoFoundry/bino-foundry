import { useRef, useState } from "react";
import { Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BeadTypeForm } from "../../components/BeadTypeForm";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { useCatalogue } from "@/state/catalogue";
import type { BeadTypeEntry } from "@/types/beads";
import {
  applyAdminSaveModalState,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
  type AdminEditorModalState,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { AdminListPagination } from "../../components/AdminListPagination";
import { useAdminList } from "../../hooks/useAdminList";

export function BeadTypesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<AdminEditorModalState<BeadTypeEntry>>(null);
  const list = useAdminList(cat.beadTypes, (t, q) => t.name.toLowerCase().includes(q));

  useAdminEditorScroll(scrollRef, modal);

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
          <BeadTypeForm
            key={modal.type === "add" ? "new" : modal.entry.id}
            initial={modal.type === "edit" ? modal.entry : undefined}
            onCancel={() => setModal(null)}
            onSave={async (entry) => {
              const mode = modal.type;
              try {
                const saved =
                  mode === "add"
                    ? await cat.addBeadType({
                        name: entry.name,
                        description: entry.description,
                        displayOrder: entry.displayOrder,
                        isActive: entry.isActive,
                        metadata: entry.metadata,
                      })
                    : await cat.updateBeadType(entry);
                applyAdminSaveModalState(mode, saved, setModal, { createdLabel: "Bead type" });
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState icon={Settings2} title="No bead types" description="Define Crystal, Charm, Spacer, and custom categories." />
        ) : (
          <>
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
                        try {
                          await cat.deleteBeadType(t.id);
                          list.cancelDelete();
                          notifyAdminDeleted("Bead type");
                        } catch (err) {
                          notifyAdminDeleteFailed(err);
                        }
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
                  {t.isActive === false ? (
                    <AdminStatusBadge label="Inactive" variant="danger" />
                  ) : null}
                  {t.description ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                  ) : null}
                </div>
              </AdminListRow>
            ))}
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
