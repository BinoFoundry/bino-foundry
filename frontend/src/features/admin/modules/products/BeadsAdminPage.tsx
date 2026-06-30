import { useMemo, useRef, useState } from "react";
import { Gem, Trash2 } from "lucide-react";

import { BeadForm } from "@/components/admin/BeadForm";
import { Button } from "@/components/ui/button";
import { formatLibraryPriceRange } from "@/features/bracelet/library-sizes";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { BeadSavePerf } from "@/features/admin/lib/bead-save-pipeline";
import {
  applyAdminSaveModalState,
  notifyAdminSaveFailed,
  type AdminEditorModalState,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibraryEntry } from "@/types/beads";

import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { AdminListPagination } from "../../components/AdminListPagination";
import { useAdminList } from "../../hooks/useAdminList";

export function BeadsAdminPage() {
  const { currencyCode } = useFormatCurrency();
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [modal, setModal] = useState<AdminEditorModalState<BeadLibraryEntry>>(null);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return cat.beadLibraries;
    return cat.beadLibraries.filter((b) => b.beadTypeId === typeFilter);
  }, [cat.beadLibraries, typeFilter]);

  const list = useAdminList(filtered, (b, q) => b.name.toLowerCase().includes(q));

  useAdminEditorScroll(scrollRef, modal, [typeFilter]);

  const typeName = (beadTypeId: string) => cat.beadTypes.find((t) => t.id === beadTypeId)?.name ?? "—";
  const defaultTypeId = typeFilter !== "all" ? typeFilter : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search beads…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add bead"
        onBack={modal ? () => setModal(null) : undefined}
        title={modal ? (modal.type === "add" ? "New bead" : "Edit bead") : "Bead library"}
        trailing={
          !modal ? (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="all">All types</option>
              {cat.beadTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <AdminPage scrollRef={scrollRef} footer={`${filtered.length} bead(s)`}>
        {modal ? (
          <BeadForm
            key={modal.type === "add" ? "new" : modal.entry.id}
            initial={modal.type === "edit" ? modal.entry : undefined}
            defaultBeadTypeId={defaultTypeId}
            onCancel={() => setModal(null)}
            onSave={async (entry, sizes: BeadLibrarySizeInput[]) => {
              const perf = new BeadSavePerf();
              const mode = modal.type;
              try {
                let saved: BeadLibraryEntry;
                if (mode === "add") {
                  saved = await perf.measure("create", () => cat.addBeadLibrary(entry, sizes));
                } else {
                  const initialSizes = sizesForLibrary(cat.beadLibrarySizes, modal.entry.id).map(
                    (offer) => ({
                      sizeMm: offer.sizeMm,
                      unitPrice: offer.unitPrice,
                      isDefault: offer.isDefault,
                    }),
                  );
                  saved = await perf.measure("save", () =>
                    cat.saveBeadLibraryEntry(entry, sizes, {
                      initial: modal.entry,
                      initialSizes,
                    }),
                  );
                }
                perf.finish(mode === "add" ? "Bead create" : "Bead save");
                applyAdminSaveModalState(mode, saved, setModal, { createdLabel: "Bead" });
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState icon={Gem} title="No beads" description="Add items to the unified bead library." />
        ) : (
          <>
            <ul className="space-y-1">
            {list.items.map((b) => (
              <AdminListRow
                key={b.id}
                onClick={() => setModal({ type: "edit", entry: b })}
                actions={
                  list.isDeleting(b.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        await cat.deleteBeadLibrary(b.id);
                        list.cancelDelete();
                      }}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => list.requestDelete(b.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )
                }
              >
                {b.image ? (
                  <img
                    src={b.image}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-border/50 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeName(b.beadTypeId)} · {formatLibraryPriceRange(cat.beadLibrarySizes, b.id, currencyCode)}
                    {b.isActive === false ? null : b.cropStatus === "ready" ? " · Ready" : " · Draft"}
                  </p>
                </div>
                {b.isActive === false ? <AdminStatusBadge label="Inactive" variant="danger" /> : null}
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
