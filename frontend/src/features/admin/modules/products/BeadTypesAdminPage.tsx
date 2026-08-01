import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BeadTypeForm } from "../../components/BeadTypeForm";
import { SubBeadTypeForm } from "../../components/SubBeadTypeForm";
import { AdminStatusBadge } from "../../components/AdminStatusBadge";
import { AdminTaxonomyStatusFilter } from "../../components/AdminTaxonomyStatusFilter";
import { useCatalogue } from "@/state/catalogue";
import {
  filterByTaxonomyStatus,
  type TaxonomyStatusFilter,
} from "@/features/admin/lib/taxonomy-status-filter";
import {
  notifyAdminCreated,
  notifyAdminDeleteFailed,
  notifyAdminDeleted,
  notifyAdminSaveFailed,
  notifyAdminSavedEdit,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";
import { useAdminListQuery } from "@/features/admin/hooks/useAdminListQuery";
import { useAdminBeadTypesRoute } from "@/features/admin/hooks/useAdminResourceEditor";
import { ADMIN_QUERY, adminResourcePath } from "@/features/admin/routing";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { AdminListPagination } from "../../components/AdminListPagination";

function viewSubBeadTypeBeadsLabel(subTypeName: string, beadTypeName?: string): string {
  const base = `View ${subTypeName} Beads`;
  return beadTypeName ? `${base} (${beadTypeName})` : base;
}

const VIEW_SUB_BEAD_TYPE_BEADS_TOOLTIP = "Open the bead library filtered to this Sub Bead Type.";

export function BeadTypesAdminPage() {
  const cat = useCatalogue();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const route = useAdminBeadTypesRoute();

  const typeStatusFilter = (searchParams.get("typeStatus") as TaxonomyStatusFilter) || "all";
  const subStatusFilter = (searchParams.get("subStatus") as TaxonomyStatusFilter) || "all";

  const setTypeStatusFilter = (value: TaxonomyStatusFilter) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "all") params.delete("typeStatus");
        else params.set("typeStatus", value);
        return params;
      },
      { replace: true },
    );
  };

  const setSubStatusFilter = (value: TaxonomyStatusFilter) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (value === "all") params.delete("subStatus");
        else params.set("subStatus", value);
        return params;
      },
      { replace: true },
    );
  };

  const selectedType = cat.beadTypes.find((t) => t.id === route.typeId);
  const editingType = route.isEditingType
    ? cat.beadTypes.find((t) => t.id === route.typeId)
    : null;
  const editingSub =
    route.isEditingSub && route.subId
      ? cat.subBeadTypes.find((s) => s.id === route.subId)
      : null;

  const subTypesForType = useMemo(
    () =>
      cat.subBeadTypes
        .filter((s) => s.beadTypeId === route.typeId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.subBeadTypes, route.typeId],
  );

  const filteredBeadTypes = useMemo(
    () => filterByTaxonomyStatus(cat.beadTypes, typeStatusFilter),
    [cat.beadTypes, typeStatusFilter],
  );
  const filteredSubTypes = useMemo(
    () => filterByTaxonomyStatus(subTypesForType, subStatusFilter),
    [subTypesForType, subStatusFilter],
  );

  const typeList = useAdminListQuery(filteredBeadTypes, (t, q) => t.name.toLowerCase().includes(q));
  const subList = useAdminListQuery(filteredSubTypes, (s, q) => s.name.toLowerCase().includes(q));

  const showTypeForm = route.isCreatingType || Boolean(editingType);
  const showSubForm = (route.isCreatingSub || Boolean(editingSub)) && Boolean(selectedType || editingType);
  const formType = selectedType ?? editingType;
  const activeModal = showTypeForm || showSubForm;

  useAdminEditorScroll(
    scrollRef,
    activeModal ? { type: "edit" as const, entry: { id: route.subId ?? route.typeId ?? "new" } } : null,
    [route.isSubTypesView, route.typeId],
  );

  const goToBeads = (subTypeId: string) => {
    navigate(`${adminResourcePath("beads")}?${ADMIN_QUERY.subBeadTypeId}=${encodeURIComponent(subTypeId)}`);
  };

  const toolbarTitle = showTypeForm
    ? route.isCreatingType
      ? "New bead type"
      : "Edit bead type"
    : showSubForm
      ? route.isCreatingSub
        ? "New sub-type"
        : "Edit sub-type"
      : route.isSubTypesView && selectedType
        ? `${selectedType.name} · Sub-types`
        : "Bead types";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={activeModal}
        search={route.isSubTypesView ? subList.search : typeList.search}
        onSearchChange={route.isSubTypesView ? subList.setSearch : typeList.setSearch}
        searchPlaceholder={route.isSubTypesView ? "Search sub-types…" : "Search bead types…"}
        onAdd={
          activeModal
            ? undefined
            : route.isSubTypesView
              ? route.typeId
                ? () => route.openCreateSub(route.typeId!)
                : undefined
              : route.openCreateType
        }
        addLabel={route.isSubTypesView ? "Add sub-type" : "Add type"}
        onBack={
          activeModal
            ? showSubForm
              ? route.closeSubEditor
              : route.closeTypeEditor
            : route.isSubTypesView
              ? route.openTypesList
              : undefined
        }
        title={toolbarTitle}
        trailing={
          activeModal ? undefined : route.isSubTypesView ? (
            <AdminTaxonomyStatusFilter value={subStatusFilter} onChange={setSubStatusFilter} />
          ) : (
            <AdminTaxonomyStatusFilter value={typeStatusFilter} onChange={setTypeStatusFilter} />
          )
        }
      />

      <AdminPage
        scrollRef={scrollRef}
        footer={
          route.isSubTypesView
            ? `${subTypesForType.length} sub-type(s)`
            : `${cat.beadTypes.length} type(s)`
        }
      >
        {showTypeForm ? (
          <BeadTypeForm
            key={route.isCreatingType ? "new-type" : editingType!.id}
            initial={editingType ?? undefined}
            onCancel={route.closeTypeEditor}
            onSave={async (entry) => {
              try {
                if (route.isCreatingType) {
                  const saved = await cat.addBeadType({
                    name: entry.name,
                    description: entry.description,
                    displayOrder: entry.displayOrder,
                    isActive: entry.isActive,
                    enableSubTypes: entry.enableSubTypes,
                    metadata: entry.metadata,
                  });
                  notifyAdminCreated("Bead type");
                  route.openEditType(saved.id);
                } else {
                  await cat.updateBeadType(entry);
                  notifyAdminSavedEdit();
                }
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : showSubForm && formType ? (
          <SubBeadTypeForm
            key={route.isCreatingSub ? "new-sub" : editingSub!.id}
            beadType={formType}
            initial={editingSub ?? undefined}
            onCancel={route.closeSubEditor}
            onSave={async (entry) => {
              try {
                if (route.isCreatingSub) {
                  const saved = await cat.addSubBeadType({
                    beadTypeId: formType.id,
                    name: entry.name,
                    description: entry.description,
                    displayOrder: entry.displayOrder,
                    isActive: entry.isActive,
                    metadata: entry.metadata,
                  });
                  notifyAdminCreated("Sub bead type");
                  route.openEditSub(formType.id, saved.id);
                } else {
                  await cat.updateSubBeadType(entry);
                  notifyAdminSavedEdit();
                }
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : !route.isSubTypesView ? (
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
                      onClick={() => route.openSubTypes(t.id)}
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              route.openEditType(t.id);
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
                    onClick={() => route.typeId && route.openEditSub(route.typeId, s.id)}
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
