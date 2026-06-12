import { useEffect, useRef, useState } from "react";
import { Gem, Heart, Trash2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import type { CrystalEntry } from "@/data/crystals";
import { isApiError } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";
import type { CharmEntry, SpacerEntry } from "@/types/catalogue";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { CrystalForm } from "../../forms";
import { CharmForm } from "@/components/admin/CharmForm";
import { SpacerForm } from "@/components/admin/SpacerForm";
import { useAdminList } from "../../hooks/useAdminList";

type ModalState =
  | { type: "add" }
  | { type: "edit"; entry: CrystalEntry }
  | null;
type CharmModalState =
  | { type: "add" }
  | { type: "edit"; entry: CharmEntry }
  | null;
type SpacerModalState =
  | { type: "add" }
  | { type: "edit"; entry: SpacerEntry }
  | null;
type ProductTab = "crystals" | "charms" | "spacers";

export function CrystalsAdminPage() {
  const { format } = useFormatCurrency();
  const cat = useCatalogue();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ProductTab>("crystals");
  const [modal, setModal] = useState<ModalState>(null);
  const [charmModal, setCharmModal] = useState<CharmModalState>(null);
  const [spacerModal, setSpacerModal] = useState<SpacerModalState>(null);
  const list = useAdminList(cat.crystals, (c, q) => c.name.toLowerCase().includes(q));
  const charmList = useAdminList(cat.charms, (c, q) => c.name.toLowerCase().includes(q));
  const spacerList = useAdminList(cat.spacers, (s, q) => s.name.toLowerCase().includes(q));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [modal, charmModal, spacerModal, tab]);

  const closeModal = () => {
    setModal(null);
    setCharmModal(null);
    setSpacerModal(null);
  };
  const editingId = modal?.type === "edit" ? modal.entry.id : null;
  const editingCharmId = charmModal?.type === "edit" ? charmModal.entry.id : null;
  const editingSpacerId = spacerModal?.type === "edit" ? spacerModal.entry.id : null;
  const activeModal = tab === "crystals" ? modal : tab === "charms" ? charmModal : spacerModal;
  const activeList = tab === "crystals" ? list : tab === "charms" ? charmList : spacerList;
  const activeCount = tab === "crystals" ? cat.crystals.length : tab === "charms" ? cat.charms.length : cat.spacers.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!activeModal}
        search={activeList.search}
        onSearchChange={activeList.setSearch}
        searchPlaceholder={`Search ${tab}…`}
        onAdd={
          activeModal
            ? undefined
            : () => {
                if (tab === "crystals") setModal({ type: "add" });
                if (tab === "charms") setCharmModal({ type: "add" });
                if (tab === "spacers") setSpacerModal({ type: "add" });
              }
        }
        addLabel={`Add ${tab.slice(0, -1)}`}
        onBack={activeModal ? closeModal : undefined}
        title={
          activeModal ? (
            <div>
              <h3 className="type-h3">
                {activeModal.type === "add"
                  ? `New ${tab.slice(0, -1)}`
                  : `Edit ${tab.slice(0, -1)}`}
              </h3>
            </div>
          ) : undefined
        }
        trailing={
          tab === "crystals" && modal?.type === "edit" ? (
            list.confirmDeleteId === modal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={list.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteCrystal(modal.entry.id);
                      list.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete crystal");
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
          ) : tab === "charms" && charmModal?.type === "edit" ? (
            charmList.confirmDeleteId === charmModal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={charmList.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteCharm(charmModal.entry.id);
                      charmList.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete charm");
                    }
                  })();
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => charmList.requestDelete(charmModal.entry.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )
          ) : tab === "spacers" && spacerModal?.type === "edit" ? (
            spacerList.confirmDeleteId === spacerModal.entry.id ? (
              <AdminDeleteConfirm
                onCancel={spacerList.cancelDelete}
                onConfirm={() => {
                  void (async () => {
                    try {
                      await cat.deleteSpacer(spacerModal.entry.id);
                      spacerList.cancelDelete();
                      closeModal();
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Failed to delete spacer");
                    }
                  })();
                }}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => spacerList.requestDelete(spacerModal.entry.id)}
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
            {activeCount} {tab}
          </span>
        }
      >
        <div className="mb-3 flex gap-2">
          <Button size="sm" variant={tab === "crystals" ? "default" : "outline"} onClick={() => setTab("crystals")}>
            <Gem className="mr-1.5 h-3.5 w-3.5" />
            Crystals
          </Button>
          <Button size="sm" variant={tab === "charms" ? "default" : "outline"} onClick={() => setTab("charms")}>
            <Heart className="mr-1.5 h-3.5 w-3.5" />
            Charms
          </Button>
          <Button size="sm" variant={tab === "spacers" ? "default" : "outline"} onClick={() => setTab("spacers")}>
            <Circle className="mr-1.5 h-3.5 w-3.5" />
            Spacers
          </Button>
        </div>
        <div ref={scrollRef}>
          {tab === "crystals" && modal ? (
            <CrystalForm
              key={modal.type === "add" ? "add" : modal.entry.id}
              initial={modal.type === "edit" ? modal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (modal.type === "add") await cat.addCrystal(e);
                  else await cat.updateCrystal(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save crystal");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : tab === "charms" && charmModal ? (
            <CharmForm
              key={charmModal.type === "add" ? "add" : charmModal.entry.id}
              initial={charmModal.type === "edit" ? charmModal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (charmModal.type === "add") await cat.addCharm(e);
                  else await cat.updateCharm(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save charm");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : tab === "spacers" && spacerModal ? (
            <SpacerForm
              key={spacerModal.type === "add" ? "add" : spacerModal.entry.id}
              initial={spacerModal.type === "edit" ? spacerModal.entry : undefined}
              onSave={async (e) => {
                try {
                  if (spacerModal.type === "add") await cat.addSpacer(e);
                  else await cat.updateSpacer(e);
                  closeModal();
                } catch (err) {
                  alert(isApiError(err) ? err.message : "Failed to save spacer");
                  throw err;
                }
              }}
              onCancel={closeModal}
            />
          ) : activeList.items.length === 0 ? (
            <AdminEmptyState />
          ) : (
            <div className="space-y-1">
              {(tab === "crystals" ? list.items : tab === "charms" ? charmList.items : spacerList.items).map((c) => (
                <AdminListRow
                  key={c.id}
                  selected={tab === "crystals" ? editingId === c.id : tab === "charms" ? editingCharmId === c.id : editingSpacerId === c.id}
                  onClick={() => {
                    if (tab === "crystals") setModal({ type: "edit", entry: c as CrystalEntry });
                    if (tab === "charms") setCharmModal({ type: "edit", entry: c as CharmEntry });
                    if (tab === "spacers") setSpacerModal({ type: "edit", entry: c as SpacerEntry });
                  }}
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
                      {format(c.price)} / bead
                      {c.type
                        ? ` · ${
                            tab === "crystals"
                              ? cat.types.find((t) => t.id === c.type)?.name ?? c.type
                              : tab === "charms"
                                ? cat.charmTypes.find((t) => t.id === c.type)?.name ?? c.type
                                : cat.spacerTypes.find((t) => t.id === c.type)?.name ?? c.type
                          }`
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
