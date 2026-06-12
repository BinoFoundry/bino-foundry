import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DEFAULT_LENS_TINT_RENDER } from "@bino-foundry/shared/types";

import { AdminDeleteConfirm } from "@/features/admin/components/AdminDeleteConfirm";
import { adminFieldClass } from "@/features/admin/components/admin-styles";
import {
  isValidHexColor,
  normalizeHexInput,
  tintPreviewStyle,
  validateHexFields,
} from "@/features/admin/lib/adminHex";
import { formatCurrencySurcharge } from "@bino-foundry/shared/currency";

import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";
import { GradientDirectionPicker } from "@/features/admin/components/tint-editor/GradientDirectionPicker";
import { TintColorControl } from "@/features/admin/components/tint-editor/TintColorControl";
import { TintEditorLivePreview } from "@/features/admin/components/tint-editor/TintEditorLivePreview";
import { isApiError } from "@/services/api";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";
import type { BuilderOptionEntry, LensTintEntry } from "@/types/sunglasses-catalog";

type Section = "tints" | "options";

function blankLensTint(): LensTintEntry {
  return {
    id: "",
    code: "",
    name: "",
    category: "gradient",
    gradientTop: DEFAULT_LENS_TINT_RENDER.gradientTop,
    gradientBottom: DEFAULT_LENS_TINT_RENDER.gradientBottom,
    opacity: DEFAULT_LENS_TINT_RENDER.opacity,
    gradientDirection: DEFAULT_LENS_TINT_RENDER.gradientDirection,
    gradientAngle: DEFAULT_LENS_TINT_RENDER.gradientAngle,
    gradientMidPosition: DEFAULT_LENS_TINT_RENDER.gradientMidPosition,
    gradientIntensity: DEFAULT_LENS_TINT_RENDER.gradientIntensity,
    priceSurcharge: 0,
    displayOrder: 0,
    isActive: true,
  };
}

export function SunglassesCatalogAdmin() {
  const { currencyCode } = useFormatCurrency();
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
            onAdd={() => setEditingTint(blankLensTint())}
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
                    opacity: entry.opacity,
                    gradientDirection: entry.gradientDirection,
                    gradientAngle: entry.gradientAngle,
                    gradientMidPosition: entry.gradientMidPosition,
                    gradientIntensity: entry.gradientIntensity,
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
                  subtitle={`${tint.category} · ${tint.code} · ${formatCurrencySurcharge(tint.priceSurcharge, currencyCode)}`}
                  active={tint.isActive}
                  selected={editingTint?.id === tint.id}
                  swatchStyle={tintPreviewStyle(tint)}
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
                  subtitle={`${option.code} · ${formatCurrencySurcharge(option.priceSurcharge, currencyCode)}`}
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
        <h3 className="type-h3">{title}</h3>
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
          {!active && <p className="text-[10px] text-status-warning">Inactive</p>}
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

function AdminFormField({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function fieldClass() {
  return adminFieldClass();
}

function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="type-body font-medium text-foreground">{title}</h4>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
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

  useEffect(() => {
    setForm(entry);
    setHexError(null);
  }, [entry]);

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
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="xl:sticky xl:top-4 xl:w-[min(100%,440px)] xl:shrink-0">
          <TintEditorLivePreview form={form} />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <EditorSection title="Catalog details" description="How this tint appears in the builder list and quotes.">
            <div className="grid gap-3 sm:grid-cols-2">
          <AdminFormField
            id="tint-code"
            label="Tint code"
            required
            hint="Internal ID (e.g. smoke-grey). Lowercase letters, numbers, and hyphens. Used in quotes and the API."
          >
            <input
              id="tint-code"
              required
              className={fieldClass()}
              placeholder="smoke-grey"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </AdminFormField>
          <AdminFormField
            id="tint-name"
            label="Display name"
            required
            hint="Label customers see when choosing this lens tint in the customiser."
          >
            <input
              id="tint-name"
              required
              className={fieldClass()}
              placeholder="Smoke grey"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </AdminFormField>
          <AdminFormField
            id="tint-surcharge"
            label="Price surcharge"
            hint="Extra amount added to the frame base price when this tint is selected. Uses your site currency (General settings). Enter 0 for no extra charge."
          >
            <input
              id="tint-surcharge"
              className={fieldClass()}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.priceSurcharge}
              onChange={(e) => setForm({ ...form, priceSurcharge: Number(e.target.value) })}
            />
          </AdminFormField>
            </div>
          </EditorSection>

          <EditorSection title="Lens appearance" description="Match what customers see on the frame photo — adjust until it looks like the real product.">
            <div className="mb-4 flex flex-wrap gap-2">
              {(["classic", "gradient"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    form.category === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {cat === "classic" ? "Classic (solid)" : "Gradient"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TintColorControl
                id="tint-color-top"
                label={isClassic ? "Lens color" : "Gradient start color"}
                required
                hint={isClassic ? "Solid tint across the lens." : "Color at the start of the gradient axis."}
                value={form.gradientTop}
                onChange={setTopColor}
                onBlur={() => {
                  if (form.gradientTop && !isValidHexColor(form.gradientTop)) {
                    setHexError("Use #RRGGBB format (e.g. #2d3748)");
                  }
                }}
              />
              {!isClassic ? (
                <TintColorControl
                  id="tint-color-bottom"
                  label="Gradient end color"
                  required
                  hint="Color at the end of the gradient axis."
                  value={form.gradientBottom}
                  onChange={(hex) => {
                    setForm({ ...form, gradientBottom: hex });
                    setHexError(null);
                  }}
                />
              ) : null}
            </div>
            <AdminFormField
              id="tint-opacity"
              label="Tint strength"
              hint="Lower = more transparent lenses (shows reflections). Higher = stronger colour. Typical product range: 0.35–0.65."
            >
              <input
                id="tint-opacity"
                className="w-full accent-primary"
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={form.opacity}
                onChange={(e) => setForm({ ...form, opacity: Number(e.target.value) })}
              />
              <p className="mt-1 flex justify-between text-xs tabular-nums text-foreground">
                <span>Subtle</span>
                <span className="type-body font-medium">{form.opacity.toFixed(2)}</span>
                <span>Strong</span>
              </p>
            </AdminFormField>
          </EditorSection>

          {!isClassic ? (
            <EditorSection title="Gradient shape" description="Control how the two colours blend across the lens.">
              <AdminFormField
                id="tint-gradient-direction"
                label="Direction"
                hint="Pick the axis the gradient runs along, or use a custom angle."
              >
                <GradientDirectionPicker
                  value={form.gradientDirection}
                  onChange={(gradientDirection) => setForm({ ...form, gradientDirection })}
                />
              </AdminFormField>
              {form.gradientDirection === "custom" ? (
                <AdminFormField
                  id="tint-gradient-angle"
                  label="Custom angle"
                  hint="0° = left→right, 90° = top→bottom, 180° = bottom→top."
                >
                  <input
                    id="tint-gradient-angle"
                    className={fieldClass()}
                    type="range"
                    min={0}
                    max={359}
                    value={form.gradientAngle}
                    onChange={(e) => setForm({ ...form, gradientAngle: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-center text-xs tabular-nums text-foreground">{form.gradientAngle}°</p>
                </AdminFormField>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminFormField
                  id="tint-mid-position"
                  label="Blend position"
                  hint="Where colours meet (midpoint along the axis)."
                >
                  <input
                    id="tint-mid-position"
                    className="w-full accent-primary"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={form.gradientMidPosition}
                    onChange={(e) => setForm({ ...form, gradientMidPosition: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-center text-xs tabular-nums text-foreground">{form.gradientMidPosition}%</p>
                </AdminFormField>
                <AdminFormField
                  id="tint-intensity"
                  label="Blend sharpness"
                  hint="Soft = gradual fade, sharp = distinct colour bands."
                >
                  <input
                    id="tint-intensity"
                    className="w-full accent-primary"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.gradientIntensity}
                    onChange={(e) => setForm({ ...form, gradientIntensity: Number(e.target.value) })}
                  />
                  <p className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Soft</span>
                    <span className="tabular-nums text-foreground">{form.gradientIntensity.toFixed(2)}</span>
                    <span>Sharp</span>
                  </p>
                </AdminFormField>
              </div>
            </EditorSection>
          ) : null}

          <EditorSection title="Listing">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminFormField
                id="tint-display-order"
                label="Display order"
                hint="Lower numbers appear first in the lens step."
              >
                <input
                  id="tint-display-order"
                  className={fieldClass()}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                />
              </AdminFormField>
              <label className="flex items-start gap-2 self-end rounded-lg border border-border/60 px-3 py-2.5 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>
                  <span className="block font-medium text-foreground">Active in customiser</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Uncheck to hide from the public builder.
                  </span>
                </span>
              </label>
            </div>
          </EditorSection>
        </div>
      </div>
      {hexError ? <p className="text-sm text-destructive">{hexError}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save tint"}
        </Button>
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
        <AdminFormField
          id="option-code"
          label="Option code"
          required
          hint="Internal ID (e.g. polarized, prescription). Must be unique. Used by the builder logic and quote summary."
        >
          <input
            id="option-code"
            required
            className={fieldClass()}
            placeholder="polarized"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </AdminFormField>
        <AdminFormField
          id="option-label"
          label="Display label"
          required
          hint="Short title shown on the toggle in the customiser options step."
        >
          <input
            id="option-label"
            required
            className={fieldClass()}
            placeholder="Polarised lenses"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </AdminFormField>
        <AdminFormField
          id="option-description"
          label="Description"
          hint="Optional helper text shown under the option in the builder."
          >
          <input
            id="option-description"
            className={fieldClass()}
            placeholder="Reduces glare on reflective surfaces"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </AdminFormField>
        <AdminFormField
          id="option-surcharge"
          label="Price surcharge"
          hint="Extra amount added to the total when this option is on. Uses your site currency (General settings). Enter 0 for no extra charge."
        >
          <input
            id="option-surcharge"
            className={fieldClass()}
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.priceSurcharge}
            onChange={(e) => setForm({ ...form, priceSurcharge: Number(e.target.value) })}
          />
        </AdminFormField>
        <AdminFormField
          id="option-tooltip"
          label="Tooltip"
          hint="Optional text shown on hover (desktop) for extra detail."
        >
          <input
            id="option-tooltip"
            className={fieldClass()}
            placeholder="Leave blank if not needed"
            value={form.tooltipText ?? ""}
            onChange={(e) => setForm({ ...form, tooltipText: e.target.value || null })}
          />
        </AdminFormField>
        <AdminFormField
          id="option-display-order"
          label="Display order"
          hint="Controls sort order in the options step. Lower numbers appear first (e.g. 10 before 100)."
        >
          <input
            id="option-display-order"
            className={fieldClass()}
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
          />
        </AdminFormField>
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.requiresManualFollowUp}
              onChange={(e) => setForm({ ...form, requiresManualFollowUp: e.target.checked })}
            />
            <span>
              <span className="block font-medium text-foreground">Requires manual follow-up</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                When enabled, “Request quote” tells the customer that your team will contact them (e.g. for
                prescription details).
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>
              <span className="block font-medium text-foreground">Active in customiser</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Uncheck to hide this add-on from the public sunglasses builder.
              </span>
            </span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Save option</Button>
      </div>
    </form>
  );
}
