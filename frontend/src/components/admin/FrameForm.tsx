import { useMemo, useState } from "react";

import { FrameRenderViewsSection } from "@/features/admin/components/FrameRenderViewsSection";
import type { FrameEntry } from "@/data/glasses";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";
import { serializeRenderViewsForApi } from "@/lib/frame-render-views";
import { isFrameViewClipReady } from "@/render/lens-clip";

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
  const blank: FrameEntry = {
    id: "",
    name: "",
    price: 0,
    description: "",
    renderViews: normalizeViews(),
  };

  const [form, setForm] = useState<FrameEntry>(initial ?? blank);
  const [renderViews, setRenderViews] = useState<FrameRenderView[]>(
    normalizeViews(initial?.renderViews),
  );
  const [saving, setSaving] = useState(false);

  const viewsReady = useMemo(
    () =>
      renderViews.every((v) => !v.plateUrl || isFrameViewClipReady(v)),
    [renderViews],
  );

  const hasAnyPlate = renderViews.some((v) => v.plateUrl);

  const set = (k: keyof FrameEntry, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return;
    if (hasAnyPlate && !viewsReady) {
      alert("Complete lens SVG clips for each uploaded view (3+ points per lens) before saving.");
      return;
    }

    const id =
      form.id || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const legacyImages = renderViews
      .filter((v) => v.plateUrl)
      .map((v) => v.plateUrl);

    setSaving(true);
    try {
      await onSave({
        ...form,
        id,
        renderViews: serializeRenderViewsForApi(renderViews),
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
            autoFocus
            required
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Aviator Classic"
          />
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
      </div>

      <FrameRenderViewsSection
        frameId={form.id || undefined}
        views={renderViews}
        onChange={setRenderViews}
      />

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
