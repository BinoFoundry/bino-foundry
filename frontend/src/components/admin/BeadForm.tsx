import { useCallback, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BeadCropEditor, beadCropEditorPlateKey } from "@/features/admin/components/BeadCropEditor";
import { BeadLibrarySizesPanel } from "@/features/admin/components/BeadLibrarySizesPanel";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { validateBeadSizeMm } from "@/lib/bead-size-mm";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import type { BeadSizeDraftRow } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import { isApiError, uploadApi } from "@/services/api";
import { isBeadCropConfigValid, type BeadCropConfig } from "@bino-foundry/shared/types";

interface BeadFormProps {
  initial?: BeadLibraryEntry;
  defaultBeadTypeId?: string;
  onSave: (entry: BeadLibraryEntry, sizes: BeadLibrarySizeInput[]) => void | Promise<void>;
  onCancel: () => void;
}

function buildSizeRows(
  globalSizes: { sizeMm: number; label: string; isActive?: boolean }[],
  libraryId: string | undefined,
  existingOffers: ReturnType<typeof sizesForLibrary>,
): BeadSizeDraftRow[] {
  return globalSizes
    .filter((s) => s.isActive !== false)
    .sort((a, b) => a.sizeMm - b.sizeMm)
    .map((gs) => {
      const offer = existingOffers.find((o) => o.sizeMm === gs.sizeMm);
      return {
        sizeMm: gs.sizeMm,
        label: gs.label,
        enabled: Boolean(offer),
        unitPrice: offer?.unitPrice ?? 0,
      };
    });
}

export function BeadForm({ initial, defaultBeadTypeId, onSave, onCancel }: BeadFormProps) {
  const cat = useCatalogue();
  const defaultType =
    defaultBeadTypeId ?? cat.beadTypes.find((t) => t.slug === "crystal")?.id ?? cat.beadTypes[0]?.id ?? "";

  const blank: BeadLibraryEntry = useMemo(
    () => ({
      id: "",
      name: "",
      image: "",
      originalImage: "",
      processedImage: "",
      beadTypeId: defaultType,
      description: "",
      isActive: true,
      displayOrder: 0,
      cropStatus: "draft",
      cropConfig: null,
    }),
    [defaultType],
  );

  const [form, setForm] = useState<BeadLibraryEntry>(initial ?? blank);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCrop, setEditingCrop] = useState(Boolean(initial?.originalImage || initial?.image));
  const [cropEditSession, setCropEditSession] = useState(0);
  const draftCropRef = useRef<BeadCropConfig | null>(initial?.cropConfig ?? null);

  const globalSizes = useMemo(
    () =>
      [...cat.beadSizes]
        .filter((s) => s.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.sizeMm - b.sizeMm),
    [cat.beadSizes],
  );

  const existingOffers = useMemo(
    () => (form.id ? sizesForLibrary(cat.beadLibrarySizes, form.id) : []),
    [cat.beadLibrarySizes, form.id],
  );

  const [sizeRows, setSizeRows] = useState<BeadSizeDraftRow[]>(() =>
    buildSizeRows(globalSizes, initial?.id, initial?.id ? sizesForLibrary(cat.beadLibrarySizes, initial.id) : []),
  );

  const resetSizeRows = useCallback(
    (libraryId?: string) => {
      const offers = libraryId ? sizesForLibrary(cat.beadLibrarySizes, libraryId) : [];
      setSizeRows(buildSizeRows(globalSizes, libraryId, offers));
    },
    [cat.beadLibrarySizes, globalSizes],
  );

  const originalUrl = form.originalImage?.trim() || form.image?.trim() || "";

  const set = <K extends keyof BeadLibraryEntry>(k: K, v: BeadLibraryEntry[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadApi.uploadImage(file);
      setForm((f) => ({
        ...f,
        originalImage: data.imageUrl,
        image: data.imageUrl,
        processedImage: "",
        cropStatus: "draft",
        cropConfig: null,
      }));
      draftCropRef.current = null;
      setCropEditSession((s) => s + 1);
      setEditingCrop(true);
    } catch (err) {
      const msg = isApiError(err) ? err.message : "Failed to upload image.";
      alert(msg);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCropDraft = (config: BeadCropConfig | null, _valid: boolean) => {
    draftCropRef.current = config;
  };

  const handleSaveCrop = (config: BeadCropConfig) => {
    draftCropRef.current = config;
    setForm((f) => ({
      ...f,
      cropConfig: config,
      cropStatus: isBeadCropConfigValid(config) ? "ready" : "draft",
      originalImage: config.originalUrl,
    }));
  };

  const handleProcessed = (processedUrl: string, config: BeadCropConfig) => {
    draftCropRef.current = config;
    setForm((f) => ({
      ...f,
      processedImage: processedUrl,
      image: processedUrl,
      cropConfig: config,
      cropStatus: "ready",
    }));
  };

  const openCropEditor = () => {
    draftCropRef.current = form.cropConfig ?? draftCropRef.current;
    setCropEditSession((s) => s + 1);
    setEditingCrop(true);
  };

  const collectSizes = (): BeadLibrarySizeInput[] | null => {
    const enabled = sizeRows.filter((r) => r.enabled);
    if (!enabled.length) {
      alert("Select at least one available size and set its price.");
      return null;
    }
    const invalidSize = enabled.find((r) => validateBeadSizeMm(r.sizeMm));
    if (invalidSize) {
      alert(validateBeadSizeMm(invalidSize.sizeMm));
      return null;
    }
    const invalidPrice = enabled.find((r) => r.unitPrice < 0 || Number.isNaN(r.unitPrice));
    if (invalidPrice) {
      alert("Each enabled size needs a valid price.");
      return null;
    }
    return enabled.map((r, i) => ({
      sizeMm: r.sizeMm,
      unitPrice: r.unitPrice,
      isDefault: i === 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim() || !form.beadTypeId) return;

    const sizes = collectSizes();
    if (!sizes) return;

    const id = form.id || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const cropConfig = draftCropRef.current ?? form.cropConfig;
    setSaving(true);
    try {
      const cropProcessed =
        cropConfig && "processedUrl" in cropConfig && typeof cropConfig.processedUrl === "string"
          ? cropConfig.processedUrl.trim()
          : "";
      const processedImage = form.processedImage?.trim() || cropProcessed;
      const originalImage = form.originalImage?.trim() || originalUrl;

      await onSave(
        {
          ...form,
          id,
          originalImage,
          processedImage,
          image: processedImage || originalImage,
          cropConfig: cropConfig ?? form.cropConfig,
          cropStatus:
            cropConfig && isBeadCropConfigValid(cropConfig) ? "ready" : form.cropStatus ?? "draft",
        },
        sizes,
      );
    } finally {
      setSaving(false);
    }
  };

  const cropReady = Boolean(form.cropConfig && isBeadCropConfigValid(form.cropConfig));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <h3 className="font-display text-sm font-semibold text-foreground">Basic information</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Amethyst, Rose Quartz"
              autoComplete="off"
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Bead type *</label>
            <select
              required
              value={form.beadTypeId}
              onChange={(e) => set("beadTypeId", e.target.value)}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {cat.beadTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Display order</label>
            <input
              type="number"
              value={form.displayOrder ?? 0}
              onChange={(e) => set("displayOrder", Number(e.target.value))}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive !== false}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Active in builder
          </label>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="min-h-[72px] w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-sm font-semibold text-foreground">Images</h3>
        <div className="flex items-center gap-4 rounded-md border border-border bg-muted/20 p-3">
          <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 hover:bg-muted">
            {originalUrl ? (
              <img src={originalUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0" onChange={handleUpload} disabled={uploading} />
          </label>
          <p className="text-xs text-muted-foreground">
            Upload source asset, then draw crop path below. Status:{" "}
            <span className={cropReady ? "text-emerald-600" : "text-amber-600"}>
              {cropReady ? "crop ready" : form.cropStatus ?? "draft"}
            </span>
          </p>
        </div>

        {originalUrl ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={editingCrop ? "default" : "secondary"}
                onClick={() => {
                  if (editingCrop) {
                    const draft = draftCropRef.current;
                    if (draft && isBeadCropConfigValid(draft)) {
                      handleSaveCrop(draft);
                    }
                    setEditingCrop(false);
                  } else {
                    openCropEditor();
                  }
                }}
              >
                {editingCrop ? "Hide crop editor" : "Edit crop"}
              </Button>
            </div>
            {editingCrop ? (
              <BeadCropEditor
                key={`${beadCropEditorPlateKey(originalUrl, form.cropConfig)}|s${cropEditSession}`}
                originalUrl={originalUrl}
                initialCrop={draftCropRef.current ?? form.cropConfig ?? undefined}
                onDraftChange={handleCropDraft}
                onSaveCrop={handleSaveCrop}
                onProcessedUpload={handleProcessed}
              />
            ) : (
              <img
                src={form.processedImage?.trim() || originalUrl}
                alt=""
                className="mx-auto max-h-40 rounded-lg border border-border object-contain"
                crossOrigin="anonymous"
              />
            )}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Available sizes</h3>
        <BeadLibrarySizesPanel rows={sizeRows} onRowsChange={setSizeRows} />
        {form.id && existingOffers.length > 0 ? (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => resetSizeRows(form.id)}
          >
            Reset sizes from saved catalogue
          </button>
        ) : null}
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save bead"}
        </Button>
      </div>
    </form>
  );
}
