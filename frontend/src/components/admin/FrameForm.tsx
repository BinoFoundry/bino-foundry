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
    isActive: true,
    displayOrder: 0,
    renderViews: normalizeViews(),
  };

  const [form, setForm] = useState<FrameEntry>(initial ?? blank);
  const [renderViews, setRenderViews] = useState<FrameRenderView[]>(
    normalizeViews(initial?.renderViews),
  );
  const [saving, setSaving] = useState(false);
  const viewsSectionRef = useRef<FrameRenderViewsSectionHandle>(null);

  const frontView = useMemo(
    () => renderViews.find((v) => v.view === "front"),
    [renderViews],
  );
  const frontHasPlate = Boolean(frontView?.plateUrl?.trim());

  const set = (k: keyof FrameEntry, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      alert("Frame name is required.");
      return;
    }

    const flushedViews = viewsSectionRef.current?.flushPendingEdits() ?? renderViews;
    setRenderViews(flushedViews);

    if (frontHasPlate && !flushedViews.every((v) => isFrameViewSaveReady(v))) {
      const message = describeFrameSaveBlockers(flushedViews);
      alert(message || "Complete the front view before saving.");
      return;
    }

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
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Display order</label>
          <input
            type="number"
            className="w-full rounded border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            value={form.displayOrder ?? 0}
            onChange={(e) => set("displayOrder", Number(e.target.value))}
          />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive !== false}
            onChange={(e) => set("isActive", e.target.checked)}
          />
          Published (visible in sunglasses customiser)
        </label>
      </div>

      <FrameRenderViewsSection ref={viewsSectionRef} views={renderViews} onChange={setRenderViews} />

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
