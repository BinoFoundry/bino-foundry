import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  CopyFrameConfigDialog,
  CopyFrameConfigTrigger,
} from "@/features/admin/components/CopyFrameConfigDialog";
import {
  FrameRenderViewsSection,
  parseFrameExpandedEditor,
  type FrameRenderViewsSectionHandle,
} from "@/features/admin/components/FrameRenderViewsSection";
import {
  describeFrameSaveBlockers,
  isFrameViewSaveReady,
} from "@/features/admin/lib/frameClipStatus";
import {
  ADMIN_UNSAVED_COPY,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "@/features/admin/unsaved-changes";
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [viewsDraftDirty, setViewsDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [copyConfigOpen, setCopyConfigOpen] = useState(false);
  const [copyDestination, setCopyDestination] = useState({
    renderViews: normalizeViews(),
    lensRenderPresetId: null as string | null | undefined,
    useLensRenderPreset: true as boolean | undefined,
  });
  const viewsSectionRef = useRef<FrameRenderViewsSectionHandle>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const viewsBlockRef = useRef<HTMLDivElement>(null);

  const dirtySnapshot = useMemo(
    () => ({
      name: form.name,
      price: form.price,
      description: form.description,
      isActive: form.isActive,
      availabilityStatusCode: form.availabilityStatusCode,
      displayOrder: form.displayOrder,
      modelFamily: form.modelFamily,
      lensRenderPresetId: form.lensRenderPresetId,
      useLensRenderPreset: form.useLensRenderPreset,
      renderViews,
    }),
    [form, renderViews],
  );
  const { isDirty: formDirty, markClean } = useDirtySnapshot(
    dirtySnapshot,
    initial?.id ?? "new",
  );
  const isDirty = formDirty || viewsDraftDirty;
  const { confirmLeave, clearDirtySync } = useUnsavedChangesGuard(
    isDirty,
    `frame-form:${initial?.id ?? "new"}`,
  );

  const expandedEditor = useMemo(
    () => parseFrameExpandedEditor(searchParams.get("axis"), searchParams.get("panel")),
    [searchParams],
  );

  const setExpandedEditor = (next: { axis: string; panel: string } | null) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (!next) {
          params.delete("axis");
          params.delete("panel");
        } else {
          params.set("axis", next.axis);
          params.set("panel", next.panel);
        }
        return params;
      },
      { replace: true },
    );
  };

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

      // Clear dirty BEFORE onSave — create flow navigates to the edit URL inside onSave.
      setViewsDraftDirty(false);
      markClean();
      clearDirtySync();

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
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Description / specifications
          </label>
          <textarea
            rows={3}
            className="w-full resize-y rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={"Shown in the frame's ⓘ popover. e.g.\nLens 53 · Bridge 23 · Temple 150\nAcetate · Square"}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Reuse crop, lenses, details, or rendering from a completed frame — then nudge for this
            plate.
          </p>
          <CopyFrameConfigTrigger
            onClick={() => {
              // Flush in-progress crop/mask drafts before conflict detection.
              const flushed = viewsSectionRef.current?.flushPendingEdits() ?? renderViews;
              setRenderViews(flushed);
              setCopyDestination({
                renderViews: flushed,
                lensRenderPresetId: form.lensRenderPresetId,
                useLensRenderPreset: form.useLensRenderPreset,
              });
              setCopyConfigOpen(true);
            }}
          />
        </div>
        <FrameRenderViewsSection
          ref={viewsSectionRef}
          views={renderViews}
          onChange={(next) => {
            setRenderViews(next);
            setViewsDraftDirty(false);
          }}
          onDraftTouch={() => setViewsDraftDirty(true)}
          expandedEditor={expandedEditor}
          onExpandedEditorChange={setExpandedEditor}
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

      <CopyFrameConfigDialog
        open={copyConfigOpen}
        onOpenChange={setCopyConfigOpen}
        frames={(cat.frames ?? []) as FrameEntry[]}
        currentFrameId={form.id || null}
        preferredFamily={form.modelFamily}
        destination={copyDestination}
        onApply={(payload) => {
          setRenderViews(normalizeViews(payload.renderViews));
          setForm((f) => ({
            ...f,
            lensRenderPresetId: payload.lensRenderPresetId ?? f.lensRenderPresetId,
            useLensRenderPreset:
              payload.useLensRenderPreset !== undefined
                ? payload.useLensRenderPreset
                : f.useLensRenderPreset,
          }));
          setViewsDraftDirty(false);
          setViewsError(null);
          toast.success("Configuration copied — review and adjust before saving.");
        }}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {isDirty ? (
          <p className="mr-auto text-xs text-muted-foreground" role="status" aria-live="polite">
            {ADMIN_UNSAVED_COPY.status}
          </p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => confirmLeave(onCancel)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save frame"}
        </Button>
      </div>
    </form>
  );
};
