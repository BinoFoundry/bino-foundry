import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/state/catalogue";
import type { HowWePrepareOption, HowWePreparePriceType, HowWePrepareStatus } from "@bino-foundry/shared/types";
import {
  applyAdminSaveModalState,
  notifyAdminSaveFailed,
  type AdminEditorModalState,
} from "@/features/admin/lib/admin-save-feedback";
import { useAdminEditorScroll } from "@/features/admin/hooks/useAdminEditorScroll";

import { AdminDeleteConfirm } from "../../components/AdminDeleteConfirm";
import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminListRow } from "../../components/AdminListRow";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useAdminList } from "../../hooks/useAdminList";
import { useFormatCurrency } from "@/hooks/use-format-currency";

const PRICE_TYPES: HowWePreparePriceType[] = ["fixed", "per_bracelet", "per_quantity"];
const STATUSES: HowWePrepareStatus[] = ["active", "inactive"];

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function HowWePrepareForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: HowWePrepareOption;
  onSave: (v: Omit<HowWePrepareOption, "id" | "createdAt" | "updatedAt">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [fullDescription, setFullDescription] = useState(initial?.fullDescription ?? "");
  const [optionType, setOptionType] = useState(initial?.optionType ?? "preparation");
  const [priceType, setPriceType] = useState<HowWePreparePriceType>(initial?.priceType ?? "fixed");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [defaultQuantity, setDefaultQuantity] = useState(initial?.defaultQuantity ?? 1);
  const [minimumQuantity, setMinimumQuantity] = useState(initial?.minimumQuantity ?? 1);
  const [maximumQuantity, setMaximumQuantity] = useState(initial?.maximumQuantity ?? 1);
  const [quantityEnabled, setQuantityEnabled] = useState(initial?.quantityEnabled ?? false);
  const [benefits, setBenefits] = useState<string[]>(initial?.benefits ?? []);
  const [newBenefit, setNewBenefit] = useState("");
  const [highlightTitle, setHighlightTitle] = useState(initial?.highlightTitle ?? "");
  const [highlightDescription, setHighlightDescription] = useState(initial?.highlightDescription ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [status, setStatus] = useState<HowWePrepareStatus>(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugifyName(value));
  };

  const addBenefit = () => {
    const trimmed = newBenefit.trim();
    if (!trimmed) return;
    setBenefits((prev) => [...prev, trimmed]);
    setNewBenefit("");
  };

  const moveBenefit = (index: number, direction: -1 | 1) => {
    setBenefits((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
        optionType: optionType.trim() || "preparation",
        priceType,
        price,
        defaultQuantity,
        minimumQuantity,
        maximumQuantity,
        quantityEnabled,
        benefits,
        highlightTitle: highlightTitle.trim(),
        highlightDescription: highlightDescription.trim(),
        badge: badge.trim() || null,
        status,
        sortOrder,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mx-auto max-w-lg space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Slug</label>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            disabled={Boolean(initial)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Short description</label>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Full description</label>
        <textarea
          value={fullDescription}
          onChange={(e) => setFullDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Price</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Price type</label>
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as HowWePreparePriceType)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {PRICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sort order</label>
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Badge</label>
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={quantityEnabled}
          onChange={(e) => setQuantityEnabled(e.target.checked)}
        />
        Quantity selector enabled
      </label>

      {quantityEnabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Default qty</label>
            <input
              type="number"
              min={1}
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Min qty</label>
            <input
              type="number"
              min={1}
              value={minimumQuantity}
              onChange={(e) => setMinimumQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max qty</label>
            <input
              type="number"
              min={1}
              value={maximumQuantity}
              onChange={(e) => setMaximumQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-border/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">Benefits</p>
        <ul className="space-y-1">
          {benefits.map((benefit, index) => (
            <li key={`${benefit}-${index}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">{benefit}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBenefit(index, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBenefit(index, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setBenefits((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={newBenefit}
            onChange={(e) => setNewBenefit(e.target.value)}
            placeholder="Add benefit…"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={addBenefit}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Highlight title</label>
        <input
          value={highlightTitle}
          onChange={(e) => setHighlightTitle(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Highlight description</label>
        <textarea
          value={highlightDescription}
          onChange={(e) => setHighlightDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as HowWePrepareStatus)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Option type</label>
          <input
            value={optionType}
            onChange={(e) => setOptionType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function HowWePrepareAdminPage() {
  const cat = useCatalogue();
  const currency = useFormatCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<AdminEditorModalState<HowWePrepareOption>>(null);
  const list = useAdminList(cat.howWePrepareOptions, (item, q) =>
    `${item.name} ${item.slug} ${item.shortDescription}`.toLowerCase().includes(q),
  );

  useAdminEditorScroll(scrollRef, modal);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar
        hideSearch={!!modal}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search preparation options…"
        onAdd={modal ? undefined : () => setModal({ type: "add" })}
        addLabel="Add option"
        onBack={modal ? () => setModal(null) : undefined}
        title={modal ? (modal.type === "add" ? "New preparation option" : "Edit preparation option") : "How We Prepare"}
      />

      <AdminPage scrollRef={scrollRef} footer={`${cat.howWePrepareOptions.length} preparation option(s)`}>
        {modal ? (
          <HowWePrepareForm
            key={modal.type === "add" ? "new" : modal.entry.id}
            initial={modal.type === "edit" ? modal.entry : undefined}
            onCancel={() => setModal(null)}
            onSave={async (entry) => {
              const mode = modal.type;
              try {
                const saved =
                  mode === "add"
                    ? await cat.addHowWePrepareOption(entry)
                    : await cat.updateHowWePrepareOption({ ...modal.entry, ...entry });
                applyAdminSaveModalState(mode, saved, setModal, { createdLabel: "Preparation option" });
              } catch (err) {
                notifyAdminSaveFailed(err);
                throw err;
              }
            }}
          />
        ) : list.items.length === 0 ? (
          <AdminEmptyState
            icon={Package}
            title="No preparation options"
            description="Define how bracelets are prepared before checkout — Ready to Wear, DIY Kit, and more."
          />
        ) : (
          <ul className="space-y-1">
            {list.items.map((item) => (
              <AdminListRow
                key={item.id}
                onClick={() => setModal({ type: "edit", entry: item })}
                actions={
                  list.isDeleting(item.id) ? (
                    <AdminDeleteConfirm
                      onCancel={list.cancelDelete}
                      onConfirm={async () => {
                        await cat.deleteHowWePrepareOption(item.id);
                        list.cancelDelete();
                      }}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => list.requestDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {item.name}
                    {item.status === "inactive" ? (
                      <span className="ml-2 text-[10px] text-muted-foreground">inactive</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.slug} · {currency.format(item.price)} · order {item.sortOrder}
                    {item.quantityEnabled ? " · qty" : ""}
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
