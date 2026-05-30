import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AdminDeleteConfirm } from "@/features/admin/components/AdminDeleteConfirm";
import {
  isValidHexColor,
  normalizeHexInput,
  tintPreviewStyle,
  validateHexFields,
} from "@/features/admin/lib/adminHex";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";
import { isApiError } from "@/services/api";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

type Section = "tints" | "options";

export function SunglassesCatalogAdmin() {
  const catalog = useSunglassesCatalog();
  const [section, setSection] = useState<Section>("tints");
  const [editingTint, setEditingTint] = useState<LensTintEntry | null>(null);
  const [editingOption, setEditingOption] = useState<BuilderOptionEntry | null>(null);
  const [confirmDeleteTintId, setConfirmDeleteTintId] = useState<string | null>(null);
  const [confirmDeleteOptionId, setConfirmDeleteOptionId] = useState<string | null>(null);
  useEffect(() => {
    void catalog.refreshAdminFromApi();
  }, [catalog.refreshAdminFromApi]);

  if (catalog.isHydrating && catalog.lensTints.length === 0) {
    return <LoadingState label="Loading sunglasses catalog…" className="h-64" />;
  }

  if (catalog.hydrateError) {
    return (
      <ErrorState
        message={catalog.hydrateError}
        onRetry={() => void catalog.refreshAdminFromApi()}
        className="m-6"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3 sm:px-6">
        {(
          [
            ["tints", "Lens tints"],
            ["options", "Add-on options"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={section === id ? "default" : "outline"}
            onClick={() => setSection(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="admin-scroll-pane p-4 sm:p-6">
        {section === "tints" && (
          <CatalogSection
            title="Lens tints"
            onAdd={() =>
              setEditingTint({
                id: "",
                code: "",
                name: "",
                category: "gradient",
                gradientTop: "#4a5568",
                gradientBottom: "#2d3748",
                priceSurcharge: 0,
                displayOrder: 0,
                isActive: true,
              })
            }
          >
            {editingTint && !editingTint.id ? (
              <TintEditor
                key="new-tint"
                entry={editingTint}
                onCancel={() => setEditingTint(null)}
                onSave={async (entry) => {
                  await catalog.createLensTint({
                    code: entry.code,
                    name: entry.name,
                    category: entry.category,
                    gradientTop: entry.gradientTop,
                    gradientBottom: entry.gradientBottom,
                    priceSurcharge: entry.priceSurcharge,
                    displayOrder: entry.displayOrder,
                    isActive: entry.isActive,
                  });
                  setEditingTint(null);
                }}
              />
            ) : null}
            {catalog.lensTints.map((tint) => (
              <div key={tint.id} className="space-y-2">
                <CatalogRow
                  title={tint.name}
                  subtitle={`${tint.category} · ${tint.code} · +$${tint.priceSurcharge}`}
                  active={tint.isActive}
                  selected={editingTint?.id === tint.id}
                  swatchStyle={tintPreviewStyle(tint.category, tint.gradientTop, tint.gradientBottom)}
                  onEdit={() => setEditingTint(tint)}
                  onDelete={() => setConfirmDeleteTintId(tint.id)}
                  confirmDelete={confirmDeleteTintId === tint.id}
                  onConfirmDelete={async () => {
                    try {
                      await catalog.deleteLensTint(tint.id);
                      setConfirmDeleteTintId(null);
                      if (editingTint?.id === tint.id) setEditingTint(null);
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Delete failed");
                    }
                  }}
                  onCancelDelete={() => setConfirmDeleteTintId(null)}
                />
                {editingTint?.id === tint.id ? (
                  <TintEditor
                    key={tint.id}
                    entry={editingTint}
                    onCancel={() => setEditingTint(null)}
                    onSave={async (entry) => {
                      await catalog.updateLensTint(entry);
                      setEditingTint(null);
                    }}
                  />
                ) : null}
              </div>
            ))}
          </CatalogSection>
        )}

        {section === "options" && (
          <CatalogSection
            title="Builder options"
            onAdd={() =>
              setEditingOption({
                id: "",
                code: "",
                label: "",
                description: "",
                priceSurcharge: 0,
                requiresManualFollowUp: false,
                tooltipText: null,
                displayOrder: 0,
                isActive: true,
              })
            }
          >
            {editingOption && !editingOption.id ? (
              <OptionEditor
                key="new-option"
                entry={editingOption}
                onCancel={() => setEditingOption(null)}
                onSave={async (entry) => {
                  await catalog.createBuilderOption({
                    code: entry.code,
                    label: entry.label,
                    description: entry.description,
                    priceSurcharge: entry.priceSurcharge,
                    requiresManualFollowUp: entry.requiresManualFollowUp,
                    tooltipText: entry.tooltipText,
                    displayOrder: entry.displayOrder,
                    isActive: entry.isActive,
                  });
                  setEditingOption(null);
                }}
              />
            ) : null}
            {catalog.builderOptions.map((option) => (
              <div key={option.id} className="space-y-2">
                <CatalogRow
                  title={option.label}
                  subtitle={`${option.code} · +$${option.priceSurcharge}`}
                  active={option.isActive}
                  selected={editingOption?.id === option.id}
                  onEdit={() => setEditingOption(option)}
                  onDelete={() => setConfirmDeleteOptionId(option.id)}
                  confirmDelete={confirmDeleteOptionId === option.id}
                  onConfirmDelete={async () => {
                    try {
                      await catalog.deleteBuilderOption(option.id);
                      setConfirmDeleteOptionId(null);
                      if (editingOption?.id === option.id) setEditingOption(null);
                    } catch (err) {
                      alert(isApiError(err) ? err.message : "Delete failed");
                    }
                  }}
                  onCancelDelete={() => setConfirmDeleteOptionId(null)}
                />
                {editingOption?.id === option.id ? (
                  <OptionEditor
                    key={option.id}
                    entry={editingOption}
                    onCancel={() => setEditingOption(null)}
                    onSave={async (entry) => {
                      await catalog.updateBuilderOption(entry);
                      setEditingOption(null);
                    }}
                  />
                ) : null}
              </div>
            ))}
          </CatalogSection>
        )}

      </div>
    </div>
  );
}

function CatalogSection({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CatalogRow({
  title,
  subtitle,
  active,
  selected = false,
  swatchStyle,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  selected?: boolean;
  swatchStyle?: React.CSSProperties;
  onEdit: () => void;
  onDelete: () => void;
  confirmDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 ${
        selected ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {swatchStyle ? (
          <span
            className="h-10 w-10 shrink-0 rounded-md border border-border shadow-inner"
            style={swatchStyle}
            aria-hidden
          />
        ) : null}
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {!active && <p className="text-[10px] text-amber-600">Inactive</p>}
        </div>
      </div>
      {confirmDelete && onConfirmDelete && onCancelDelete ? (
        <AdminDeleteConfirm onCancel={onCancelDelete} onConfirm={onConfirmDelete} />
      ) : (
        <div className="flex shrink-0 gap-1">
          {!selected ? (
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

function fieldClass() {
  return "w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50";
}

function TintEditor({
  entry,
  onSave,
  onCancel,
}: {
  entry: LensTintEntry;
  onSave: (entry: LensTintEntry) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(entry);
  const [hexError, setHexError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isClassic = form.category === "classic";

  const setCategory = (category: LensTintEntry["category"]) => {
    setForm((f) => {
      if (category === "classic") {
        return { ...f, category, gradientBottom: f.gradientTop };
      }
      return { ...f, category };
    });
    setHexError(null);
  };

  const setTopColor = (raw: string) => {
    const gradientTop = normalizeHexInput(raw);
    setForm((f) => ({
      ...f,
      gradientTop,
      gradientBottom: f.category === "classic" ? gradientTop : f.gradientBottom,
    }));
    setHexError(null);
  };

  return (
    <form
      className="ml-2 space-y-3 rounded-xl border border-primary/30 border-l-2 border-l-primary bg-primary/5 p-4 sm:ml-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err = validateHexFields(
          isClassic
            ? [{ label: "Lens color", value: form.gradientTop }]
            : [
                { label: "Gradient top", value: form.gradientTop },
                { label: "Gradient bottom", value: form.gradientBottom },
              ],
        );
        if (err) {
          setHexError(err);
          return;
        }
        const payload: LensTintEntry = isClassic
          ? { ...form, gradientBottom: form.gradientTop }
          : form;
        setSaving(true);
        void Promise.resolve(onSave(payload)).finally(() => setSaving(false));
      }}
    >
      <div className="flex items-start gap-4">
        <span
          className="h-16 w-16 shrink-0 rounded-lg border border-border shadow-inner"
          style={tintPreviewStyle(form.category, form.gradientTop, form.gradientBottom)}
          title="Preview (matches customiser)"
        />
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <input className={fieldClass()} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={fieldClass()} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select
            className={fieldClass()}
            value={form.category}
            onChange={(e) => setCategory(e.target.value as LensTintEntry["category"])}
          >
            <option value="classic">Classic</option>
            <option value="gradient">Gradient</option>
          </select>
          <input className={fieldClass()} type="number" step="0.01" placeholder="Surcharge" value={form.priceSurcharge} onChange={(e) => setForm({ ...form, priceSurcharge: Number(e.target.value) })} />
          <input
            className={fieldClass()}
            placeholder={isClassic ? "Color #RRGGBB" : "Gradient top #RRGGBB"}
            value={form.gradientTop}
            onChange={(e) => setTopColor(e.target.value)}
            onBlur={() => {
              if (form.gradientTop && !isValidHexColor(form.gradientTop)) {
                setHexError("Use #RRGGBB format (e.g. #2d3748)");
              }
            }}
          />
          {!isClassic ? (
            <input
              className={fieldClass()}
              placeholder="Gradient bottom #RRGGBB"
              value={form.gradientBottom}
              onChange={(e) => {
                setForm({ ...form, gradientBottom: normalizeHexInput(e.target.value) });
                setHexError(null);
              }}
            />
          ) : null}
          <input className={fieldClass()} type="number" placeholder="Display order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </div>
      {hexError ? <p className="text-sm text-destructive">{hexError}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save tint"}</Button>
      </div>
    </form>
  );
}

function OptionEditor({
  entry,
  onSave,
  onCancel,
}: {
  entry: BuilderOptionEntry;
  onSave: (entry: BuilderOptionEntry) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(entry);
  return (
    <form
      className="ml-2 space-y-3 rounded-xl border border-primary/30 border-l-2 border-l-primary bg-primary/5 p-4 sm:ml-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={fieldClass()} placeholder="Code (e.g. prescription)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className={fieldClass()} placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input className={fieldClass()} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className={fieldClass()} type="number" step="0.01" placeholder="Price surcharge" value={form.priceSurcharge} onChange={(e) => setForm({ ...form, priceSurcharge: Number(e.target.value) })} />
        <input className={fieldClass()} placeholder="Tooltip (optional)" value={form.tooltipText ?? ""} onChange={(e) => setForm({ ...form, tooltipText: e.target.value || null })} />
        <input className={fieldClass()} type="number" placeholder="Display order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.requiresManualFollowUp} onChange={(e) => setForm({ ...form, requiresManualFollowUp: e.target.checked })} />
          Manual follow-up
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Save option</Button>
      </div>
    </form>
  );
}
