import { useMemo, useRef, useState } from "react";
import { ChevronRight, Settings2, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BeadTypeForm } from "../../components/BeadTypeForm";
import { SubBeadTypeForm } from "../../components/SubBeadTypeForm";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminTaxonomyStatusFilter } from "../../components/AdminTaxonomyStatusFilter";
import { useCatalogue } from "@/state/catalogue";
import type { BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  filterByTaxonomyStatus,
  type TaxonomyStatusFilter,
} from "@/features/admin/lib/taxonomy-status-filter";
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

type View = "types" | "subtypes";

function viewSubBeadTypeBeadsLabel(subTypeName: string, beadTypeName?: string): string {
  const base = `View ${subTypeName} Beads`;
  return beadTypeName ? `${base} (${beadTypeName})` : base;
}

const VIEW_SUB_BEAD_TYPE_BEADS_TOOLTIP = "Open the bead library filtered to this Sub Bead Type.";

export function BeadTypesAdminPage() {
  const cat = useCatalogue();
  const [, setSearchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("types");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [typeModal, setTypeModal] = useState<AdminEditorModalState<BeadTypeEntry>>(null);
  const [subModal, setSubModal] = useState<AdminEditorModalState<SubBeadTypeEntry>>(null);
  const [typeStatusFilter, setTypeStatusFilter] = useState<TaxonomyStatusFilter>("all");
  const [subStatusFilter, setSubStatusFilter] = useState<TaxonomyStatusFilter>("all");

  const selectedType = cat.beadTypes.find((t) => t.id === selectedTypeId);
  const subTypesForType = useMemo(
    () =>
      cat.subBeadTypes
        .filter((s) => s.beadTypeId === selectedTypeId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.subBeadTypes, selectedTypeId],
  );

  const filteredBeadTypes = useMemo(
    () => filterByTaxonomyStatus(cat.beadTypes, typeStatusFilter),
    [cat.beadTypes, typeStatusFilter],
  );
  const filteredSubTypes = useMemo(
    () => filterByTaxonomyStatus(subTypesForType, subStatusFilter),
    [subTypesForType, subStatusFilter],
  );

  const typeList = useAdminList(filteredBeadTypes, (t, q) => t.name.toLowerCase().includes(q));
  const subList = useAdminList(filteredSubTypes, (s, q) => s.name.toLowerCase().includes(q));

  const activeModal = typeModal ?? subModal;
  useAdminEditorScroll(scrollRef, activeModal, [view, selectedTypeId]);

  const openSubTypes = (typeId: string) => {
    setSelectedTypeId(typeId);
    setView("subtypes");
    setTypeModal(null);
    setSubModal(null);
  };

  const goToBeads = (subTypeId: string) => {
    setSearchParams({ section: "beads", subBeadTypeId: subTypeId }, { replace: false });
  };

  const toolbarTitle = typeModal
    ? typeModal.type === "add"
      ? "New bead type"
      : "Edit bead type"
    : subModal
      ? subModal.type === "add"
        ? "New sub-type"
        : "Edit sub-type"
      : view === "subtypes" && selectedType
        ? `${selectedType.name} · Sub-types`
        : "Bead types";

  const showTypeForm = Boolean(typeModal);
  const showSubForm = Boolean(subModal && selectedType);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!activeModal}
        search={view === "types" ? typeList.search : subList.search}
        onSearchChange={view === "types" ? typeList.setSearch : subList.setSearch}
        searchPlaceholder={view === "types" ? "Search bead types…" : "Search sub-types…"}
        onAdd={
          activeModal
            ? undefined
            : view === "types"
              ? () => setTypeModal({ type: "add" })
              : selectedType
                ? () => setSubModal({ type: "add" })
                : undefined
        }
        addLabel={view === "types" ? "Add type" : "Add sub-type"}
        onBack={
          activeModal
            ? () => {
                setTypeModal(null);
                setSubModal(null);
              }
            : view === "subtypes"
              ? () => {
                  setView("types");
                  setSelectedTypeId("");
                }
              : undefined
        }
        title={toolbarTitle}
        trailing={
          activeModal ? undefined : view === "types" ? (
            <AdminTaxonomyStatusFilter value={typeStatusFilter} onChange={setTypeStatusFilter} />
          ) : (
            <AdminTaxonomyStatusFilter value={subStatusFilter} onChange={setSubStatusFilter} />
          )
        }
      />

      <AdminPage
        scrollRef={scrollRef}
        footer={
          view === "types"
            ? `${cat.beadTypes.length} type(s)`
            : `${subTypesForType.length} sub-type(s)`
        }
      >
        {showTypeForm ? (
          <BeadTypeForm
            key={typeModal!.type === "add" ? "new-type" : typeModal!.entry.id}
            initial={typeModal!.type === "edit" ? typeModal!.entry : undefined}
            onCancel={() => setTypeModal(null)}
            onSave={async (entry) => {
              const mode = typeModal!.type;
              try {
                const saved =
                  mode === "add"
                    ? await cat.addBeadType({
                        name: entry.name,
                        description: entry.description,
                        displayOrder: entry.displayOrder,
                        isActive: entry.isActive,
                        enableSubTypes: entry.enableSubTypes,
                        metadata: entry.metadata,
                      })
                    : await cat.updateBeadType(entry);
                applyAdminSaveModalState(mode, saved, setTypeModal, { createdLabel: "Bead type" });
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : showSubForm && selectedType ? (
          <SubBeadTypeForm
            key={subModal!.type === "add" ? "new-sub" : subModal!.entry.id}
            beadType={selectedType}
            initial={subModal!.type === "edit" ? subModal!.entry : undefined}
            onCancel={() => setSubModal(null)}
            onSave={async (entry) => {
              const mode = subModal!.type;
              try {
                const saved =
                  mode === "add"
                    ? await cat.addSubBeadType({
                        beadTypeId: selectedType.id,
                        name: entry.name,
                        description: entry.description,
                        displayOrder: entry.displayOrder,
                        isActive: entry.isActive,
                        metadata: entry.metadata,
                      })
                    : await cat.updateSubBeadType(entry);
                applyAdminSaveModalState(mode, saved, setSubModal, { createdLabel: "Sub bead type" });
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : view === "types" ? (
          typeList.items.length === 0 ? (
            <AdminEmptyState
              icon={Settings2}
              title="No bead types"
              description="Define Crystal, Charm, Spacer, and custom categories."
            />
          ) : (
            <>
              <ul className="space-y-1">
                {typeList.items.map((t) => {
                  const subCount = cat.subBeadTypes.filter((s) => s.beadTypeId === t.id).length;
                  return (
                    <AdminListRow
                      key={t.id}
                      onClick={() => openSubTypes(t.id)}
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTypeModal({ type: "edit", entry: t });
                            }}
                          >
                            Edit
                          </Button>
                          {typeList.isDeleting(t.id) ? (
                            <AdminDeleteConfirm
                              onCancel={typeList.cancelDelete}
                              onConfirm={async () => {
                                try {
                                  await cat.deleteBeadType(t.id);
                                  typeList.cancelDelete();
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
                              onClick={(e) => {
                                e.stopPropagation();
                                typeList.requestDelete(t.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{t.slug}</p>
                        <p className="text-xs text-muted-foreground">
                          {subCount} sub-type{subCount === 1 ? "" : "s"}
                        </p>
                        {t.isActive === false ? (
                          <AdminStatusBadge label="Inactive" variant="danger" />
                        ) : (
                          <AdminStatusBadge label="Active" variant="success" />
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </AdminListRow>
                  );
                })}
              </ul>
              <AdminListPagination
                page={typeList.page}
                totalPages={typeList.totalPages}
                totalItems={typeList.totalItems}
                pageSize={typeList.pageSize}
                onPageChange={typeList.setPage}
              />
            </>
          )
        ) : subList.items.length === 0 ? (
          <AdminEmptyState
            icon={Settings2}
            title="No sub-types"
            description={`Add sub-types under ${selectedType?.name ?? "this type"}.`}
          />
        ) : (
          <>
            <ul className="space-y-1">
              {subList.items.map((s) => {
                const beadCount = cat.beadLibraries.filter((b) => b.subBeadTypeId === s.id).length;
                return (
                  <AdminListRow
                    key={s.id}
                    onClick={() => setSubModal({ type: "edit", entry: s })}
                    actions={
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto min-h-8 max-w-none shrink-0 whitespace-normal px-3 py-1.5 text-left text-xs leading-snug"
                              aria-label={viewSubBeadTypeBeadsLabel(s.name, selectedType?.name)}
                              onClick={(e) => {
                                e.stopPropagation();
                                goToBeads(s.id);
                              }}
                            >
                              {viewSubBeadTypeBeadsLabel(s.name, selectedType?.name)}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{VIEW_SUB_BEAD_TYPE_BEADS_TOOLTIP}</TooltipContent>
                        </Tooltip>
                        {subList.isDeleting(s.id) ? (
                          <AdminDeleteConfirm
                            onCancel={subList.cancelDelete}
                            onConfirm={async () => {
                              try {
                                await cat.deleteSubBeadType(s.id);
                                subList.cancelDelete();
                                notifyAdminDeleted("Sub bead type");
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
                            onClick={(e) => {
                              e.stopPropagation();
                              subList.requestDelete(s.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{s.slug}</p>
                      <p className="text-xs text-muted-foreground">
                        {beadCount} bead{beadCount === 1 ? "" : "s"}
                      </p>
                      {s.isActive === false ? (
                        <AdminStatusBadge label="Inactive" variant="danger" />
                      ) : (
                        <AdminStatusBadge label="Active" variant="success" />
                      )}
                    </div>
                  </AdminListRow>
                );
              })}
            </ul>
            <AdminListPagination
              page={subList.page}
              totalPages={subList.totalPages}
              totalItems={subList.totalItems}
              pageSize={subList.pageSize}
              onPageChange={subList.setPage}
            />
          </>
        )}
      </AdminPage>
    </div>
  );
}
