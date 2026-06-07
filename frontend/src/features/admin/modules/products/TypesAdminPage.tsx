import { useEffect, useRef, useState } from "react";
import { Circle, Gem, Heart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isApiError } from "@/services/api";
import type { CharmTypeEntry, SpacerTypeEntry, TypeEntry } from "@/types/catalogue";
import { useCatalogue } from "@/state/catalogue";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { TypeForm } from "../../forms";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState = { type: "add" } | { type: "edit"; entry: TypeEntry } | null;
type CharmTypeModalState = { type: "add" } | { type: "edit"; entry: CharmTypeEntry } | null;
type SpacerTypeModalState = { type: "add" } | { type: "edit"; entry: SpacerTypeEntry } | null;
type TypeTab = "crystal-types" | "charm-types" | "spacer-types";

export function TypesAdminPage() {
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TypeTab>("crystal-types");
  const [modal, setModal] = useState<ModalState>(null);
  const [charmModal, setCharmModal] = useState<CharmTypeModalState>(null);
  const [spacerModal, setSpacerModal] = useState<SpacerTypeModalState>(null);
  const list = useAdminList(cat.types ?? [], (t, q) => t.name.toLowerCase().includes(q));
  const charmTypeList = useAdminList(cat.charmTypes ?? [], (t, q) => t.name.toLowerCase().includes(q));
  const spacerTypeList = useAdminList(cat.spacerTypes ?? [], (t, q) => t.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal, charmModal, spacerModal, tab]);

  const closeModal = () => {
    setModal(null);
    setCharmModal(null);
    setSpacerModal(null);
  };
  const activeModal = tab === "crystal-types" ? modal : tab === "charm-types" ? charmModal : spacerModal;
  const activeList = tab === "crystal-types" ? list : tab === "charm-types" ? charmTypeList : spacerTypeList;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!activeModal}
        search={activeList.search}
        onSearchChange={activeList.setSearch}
        searchPlaceholder="Search types…"
        onAdd={
          activeModal
            ? undefined
            : () => {
                if (tab === "crystal-types") setModal({ type: "add" });
                if (tab === "charm-types") setCharmModal({ type: "add" });
                if (tab === "spacer-types") setSpacerModal({ type: "add" });
              }
        }
        addLabel="Add type"
        onBack={activeModal ? closeModal : undefined}
        title={
          activeModal ? (
            <h3 className="type-h3">
              {activeModal.type === "add" ? "New type" : "Edit type"}
            </h3>
          ) : undefined
        }
        trailing={
          tab === "crystal-types" && modal?.type === "edit" ? (
            list.confirmDeleteId === modal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={list.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteType(modal.entry.id);
                      list.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete type");
                    }
                  })();
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
          ) : tab === "charm-types" && charmModal?.type === "edit" ? (
            charmTypeList.confirmDeleteId === charmModal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={charmTypeList.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteCharmType(charmModal.entry.id);
                      charmTypeList.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete charm type");
                    }
                  })();
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => charmTypeList.requestDelete(charmModal.entry.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )
          ) : tab === "spacer-types" && spacerModal?.type === "edit" ? (
            spacerTypeList.confirmDeleteId === spacerModal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={spacerTypeList.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteSpacerType(spacerModal.entry.id);
                      spacerTypeList.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete spacer type");
                    }
                  })();
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => spacerTypeList.requestDelete(spacerModal.entry.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )
          ) : undefined
        }
      />

      <AdminPage footer={<span>{activeList.items.length} types</span>}>
        <div className="mb-3 flex gap-2">
          <Button size="sm" variant={tab === "crystal-types" ? "default" : "outline"} onClick={() => setTab("crystal-types")}>
            <Gem className="mr-1.5 h-3.5 w-3.5" />
            Crystal types
          </Button>
          <Button size="sm" variant={tab === "charm-types" ? "default" : "outline"} onClick={() => setTab("charm-types")}>
            <Heart className="mr-1.5 h-3.5 w-3.5" />
            Charm types
          </Button>
          <Button size="sm" variant={tab === "spacer-types" ? "default" : "outline"} onClick={() => setTab("spacer-types")}>
            <Circle className="mr-1.5 h-3.5 w-3.5" />
            Spacer types
          </Button>
        </div>
        <div ref={scrollRef}>
          {tab === "crystal-types" && modal ? (
            <TypeForm
              key={modal.type === "add" ? "add" : modal.entry.id}
              initial={modal.type === "edit" ? modal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (modal.type === "add") await cat.addType(e);
                  else await cat.updateType(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save type");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : tab === "charm-types" && charmModal ? (
            <TypeForm
              key={charmModal.type === "add" ? "add" : charmModal.entry.id}
              initial={charmModal.type === "edit" ? charmModal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (charmModal.type === "add") await cat.addCharmType(e);
                  else await cat.updateCharmType(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save charm type");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : tab === "spacer-types" && spacerModal ? (
            <TypeForm
              key={spacerModal.type === "add" ? "add" : spacerModal.entry.id}
              initial={spacerModal.type === "edit" ? spacerModal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (spacerModal.type === "add") await cat.addSpacerType(e);
                  else await cat.updateSpacerType(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save spacer type");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : activeList.items.length === 0 ? (
            <AdminEmptyState />
          ) : (
            <div className="space-y-1">
              {(tab === "crystal-types" ? list.items : tab === "charm-types" ? charmTypeList.items : spacerTypeList.items).map((t) => (
                <AdminListRow
                  key={t.id}
                  onClick={() => {
                    if (tab === "crystal-types") setModal({ type: "edit", entry: t as TypeEntry });
                    if (tab === "charm-types") setCharmModal({ type: "edit", entry: t as CharmTypeEntry });
                    if (tab === "spacer-types") setSpacerModal({ type: "edit", entry: t as SpacerTypeEntry });
                  }}
                >
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
