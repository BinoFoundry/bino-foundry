import { useMemo, useRef, useState } from "react";

import { FrameRenderViewsSection, type FrameRenderViewsSectionHandle } from "@/features/admin/components/FrameRenderViewsSection";
import {
  describeFrameSaveBlockers,
  isFrameViewSaveReady,
} from "@/features/admin/lib/frameClipStatus";
import type { FrameEntry } from "@/data/glasses";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";
import { prepareRenderViewsForSave } from "@/lib/prepare-frame-views-for-save";
import { serializeRenderViewsForApi } from "@/lib/frame-render-views";
import { useCatalogue } from "@/state/catalogue";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";

import { Button } from "../ui/button";

interface FrameFormProps {
  initial?: FrameEntry;
  onSave: (entry: FrameEntry) => void | Promise<void>;
  onCancel: () => void;
}

function normalizeViews(views?: FrameRenderView[]): FrameRenderView[] {
  return FRAME_VIEW_AXES.map((axis) => {
    const found = views?.find((v) => v.view === axis);
    return (
      found ?? {
        view: axis,
        plateUrl: "",
        width: 0,
        height: 0,
        clipConfig: null,
        clipStatus: "draft" as const,
        maskConfig: null,
        maskStatus: "draft" as const,
      }
    );
  });
}

export const FrameForm = ({ initial, onSave, onCancel }: FrameFormProps) => {
  const cat = useCatalogue();
  const sunglassesCatalog = useSunglassesCatalog();
  const defaultPresetId =
    sunglassesCatalog.lensRenderPresets.find((p) => p.isDefault)?.id ??
    sunglassesCatalog.lensRenderPresets[0]?.id ??
    null;

  const blank: FrameEntry = {
    id: "",
    name: "",
    price: 0,
    description: "",
    isActive: true,
    availabilityStatusCode: "ACTIVE",
    displayOrder: 0,
    modelFamily: null,
    lensRenderPresetId: defaultPresetId,
    useLensRenderPreset: true,
    renderViews: normalizeViews(),
  };

  const [form, setForm] = useState<FrameEntry>({
    ...blank,
    ...initial,
    modelFamily: initial?.modelFamily ?? null,
    lensRenderPresetId: initial?.lensRenderPresetId ?? defaultPresetId,
    useLensRenderPreset: initial?.useLensRenderPreset !== false,
    renderViews: normalizeViews(initial?.renderViews),
  });
  const [renderViews, setRenderViews] = useState<FrameRenderView[]>(
    normalizeViews(initial?.renderViews),
  );
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const viewsSectionRef = useRef<FrameRenderViewsSectionHandle>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const viewsBlockRef = useRef<HTMLDivElement>(null);

  const frontView = useMemo(
    () => renderViews.find((v) => v.view === "front"),
    [renderViews],
  );
  const frontHasPlate = Boolean(frontView?.plateUrl?.trim());

  const set = (k: keyof FrameEntry, v: string | number | boolean | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      setNameError("Frame name is required.");
      nameRef.current?.focus();
      return;
    }
    setNameError(null);

    const flushedViews = viewsSectionRef.current?.flushPendingEdits() ?? renderViews;
    setRenderViews(flushedViews);

    if (frontHasPlate && !flushedViews.every((v) => isFrameViewSaveReady(v))) {
      const message = describeFrameSaveBlockers(flushedViews);
      setViewsError(message || "Complete the front view before saving.");
      viewsBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    setViewsError(null);

    const id =
      form.id || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    setSaving(true);
    try {
      const preparedViews = await prepareRenderViewsForSave(flushedViews);
      const legacyImages = preparedViews.filter((v) => v.plateUrl).map((v) => v.plateUrl);

      await onSave({
        ...form,
        id,
        renderViews: serializeRenderViewsForApi(preparedViews),
        frameImages: legacyImages,
        lensColors: [],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Frame name *</label>
          <input
            ref={nameRef}
            autoFocus
            required
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              setNameError(null);
            }}
            placeholder="e.g. Aviator Classic"
            aria-invalid={nameError ? true : undefined}
          />
          {nameError ? <p className="mt-1 text-xs text-destructive">{nameError}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Price</label>
          <input
            type="number"
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.price || ""}
            onChange={(e) => set("price", e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="120"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <input
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Model family</label>
          <input
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.modelFamily ?? ""}
            onChange={(e) => set("modelFamily", e.target.value.trim() ? e.target.value : null)}
            placeholder="e.g. Aviator Classic"
            list="frame-model-family-suggestions"
          />
          <datalist id="frame-model-family-suggestions">
            {[...new Set(
              (cat.frames ?? [])
                .map((f) => f.modelFamily?.trim())
                .filter((v): v is string => Boolean(v)),
            )]
              .sort((a, b) => a.localeCompare(b))
              .map((family) => (
                <option key={family} value={family} />
              ))}
          </datalist>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Groups size variants. Detail stamps and duplicate workflows use this label.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Display order</label>
          <input
            type="number"
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.displayOrder ?? 0}
            onChange={(e) => set("displayOrder", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Availability status</label>
          <select
            value={form.availabilityStatusCode ?? (form.isActive === false ? "INACTIVE" : "ACTIVE")}
            onChange={(e) => {
              const code = e.target.value;
              set("availabilityStatusCode", code);
              const status = cat.catalogAvailabilityStatuses.find((s) => s.code === code);
              if (status) set("isActive", status.showInBuilder);
            }}
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          >
            {cat.catalogAvailabilityStatuses.map((status) => (
              <option key={status.code} value={status.code}>
                {status.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {cat.catalogAvailabilityStatuses.find(
              (s) => s.code === (form.availabilityStatusCode ?? (form.isActive === false ? "INACTIVE" : "ACTIVE")),
            )?.description ?? ""}
          </p>
        </div>
      </div>

      <div ref={viewsBlockRef} className="space-y-2">
        {viewsError ? <p className="text-xs text-destructive">{viewsError}</p> : null}
        <FrameRenderViewsSection
          ref={viewsSectionRef}
          views={renderViews}
          onChange={setRenderViews}
          modelFamily={form.modelFamily ?? null}
          lensRenderPresetId={form.lensRenderPresetId ?? null}
          useLensRenderPreset={form.useLensRenderPreset !== false}
          lensRenderPresets={sunglassesCatalog.lensRenderPresets}
          lensRenderSystemDefaults={sunglassesCatalog.lensRenderSystemDefaults}
          onLensRenderAssignmentChange={({ lensRenderPresetId, useLensRenderPreset }) => {
            setForm((f) => ({ ...f, lensRenderPresetId, useLensRenderPreset }));
          }}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save frame"}
        </Button>
      </div>
    </form>
  );
};
