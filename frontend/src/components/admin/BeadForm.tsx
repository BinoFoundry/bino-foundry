import { useCallback, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BeadCropEditor, beadCropEditorPlateKey } from "@/features/admin/components/BeadCropEditor";
import { BeadAssetValidationPanel } from "@/features/admin/components/BeadAssetValidationPanel";
import { BeadLibrarySizesPanel } from "@/features/admin/components/BeadLibrarySizesPanel";
import { NormalizedExportDebugPanel } from "@/features/admin/components/NormalizedExportDebugPanel";
import { BeadTagsField } from "@/features/admin/components/BeadTagsField";
import { StrandRenderConfigPanel } from "@/features/admin/components/StrandRenderConfigPanel";
import { useAdminDeveloperMode } from "@/features/admin/lib/developer-mode";
import { formatUploadErrorMessage, validateUploadFile } from "@/features/admin/lib/upload-pipeline";
import { sizesForLibrary } from "@/features/bracelet/library-sizes";
import { validateBeadSizeMm } from "@/lib/bead-size-mm";
import { resolveStrandRenderConfigForBead, resolveStrandRenderConfigForSubBeadType } from "@/render/bead-crop";
import { useCatalogue } from "@/state/catalogue";
import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import type { BeadSizeDraftRow } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import { isApiError, uploadApi, beadLibrarySizesApi } from "@/services/api";
import {
  DEFAULT_STRAND_RENDER_PROFILE,
  isBeadCropConfigValid,
  mergeLazyStrandRenderOverride,
  parseStrandRenderProfile,
  pruneStrandRenderOverride,
  strandRenderOverrideIsEmpty,
  type BeadCropConfig,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

interface BeadFormProps {
  initial?: BeadLibraryEntry;
  defaultBeadTypeId?: string;
  defaultSubBeadTypeId?: string;
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

function updateStrandOverride(
  form: BeadLibraryEntry,
  patch: Record<string, unknown>,
  inherited: StrandRenderProfile,
): BeadLibraryEntry {
  const meta = form.metadata as { strandRenderOverride?: unknown } | undefined;
  const current = parseStrandRenderProfile(meta?.strandRenderOverride) ?? {};
  const next = mergeLazyStrandRenderOverride(current, patch, inherited);
  if (strandRenderOverrideIsEmpty(next)) {
    return setInheritTypeDefaults(form, true);
  }
  return {
    ...form,
    metadata: {
      ...(form.metadata ?? {}),
      useTypeStrandDefaults: false,
      strandRenderOverride: next,
    },
  };
}

function setInheritTypeDefaults(form: BeadLibraryEntry, inherit: boolean): BeadLibraryEntry {
  const meta = { ...(form.metadata ?? {}) } as Record<string, unknown>;
  if (inherit) {
    delete meta.strandRenderOverride;
    meta.useTypeStrandDefaults = true;
  } else {
    meta.useTypeStrandDefaults = false;
  }
  return { ...form, metadata: meta };
}

export function BeadForm({ initial, defaultBeadTypeId, defaultSubBeadTypeId, onSave, onCancel }: BeadFormProps) {
  const cat = useCatalogue();
  const developerMode = useAdminDeveloperMode();
  const defaultType =
    defaultBeadTypeId ?? cat.beadTypes.find((t) => t.slug === "crystal")?.id ?? cat.beadTypes[0]?.id ?? "";
  const defaultSubType =
    defaultSubBeadTypeId ??
    cat.subBeadTypes.find((s) => s.beadTypeId === defaultType && s.isActive !== false)?.id ??
    cat.subBeadTypes.find((s) => s.beadTypeId === defaultType)?.id ??
    "";

  const blank: BeadLibraryEntry = useMemo(
    () => ({
      id: "",
      name: "",
      image: "",
      originalImage: "",
      processedImage: "",
      beadTypeId: defaultType,
      subBeadTypeId: defaultSubType,
      description: "",
      isActive: true,
      availabilityStatusCode: "ACTIVE",
      displayOrder: 0,
      cropStatus: "draft",
      cropConfig: null,
    }),
    [defaultType, defaultSubType],
  );

  const [form, setForm] = useState<BeadLibraryEntry>(initial ?? blank);
  const [tagNames, setTagNames] = useState<string[]>(() => initial?.tags?.map((tag) => tag.name) ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sizesError, setSizesError] = useState<string | null>(null);
  const [editingCrop, setEditingCrop] = useState(Boolean(initial?.originalImage || initial?.image));
  const [cropEditSession, setCropEditSession] = useState(0);
  const draftCropRef = useRef<BeadCropConfig | null>(initial?.cropConfig ?? null);
  const sizesSectionRef = useRef<HTMLElement>(null);

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

  const enabledSizeMms = useMemo(
    () => sizeRows.filter((r) => r.enabled).map((r) => r.sizeMm),
    [sizeRows],
  );

  const originalUrl = form.originalImage?.trim() || form.image?.trim() || "";

  const set = <K extends keyof BeadLibraryEntry>(k: K, v: BeadLibraryEntry[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      toast.error(
        validationError.includes("mime")
          ? "Unsupported image format. Please upload PNG, JPEG, or WebP."
          : validationError,
      );
      if (e.target) e.target.value = "";
      return;
    }

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
      toast.error(formatUploadErrorMessage(err));
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
      setSizesError("Select at least one available size and set its price.");
      sizesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return null;
    }
    const invalidSize = enabled.find((r) => validateBeadSizeMm(r.sizeMm));
    if (invalidSize) {
      setSizesError(validateBeadSizeMm(invalidSize.sizeMm));
      sizesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return null;
    }
    const invalidPrice = enabled.find((r) => r.unitPrice < 0 || Number.isNaN(r.unitPrice));
    if (invalidPrice) {
      setSizesError("Each enabled size needs a valid price.");
      sizesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return null;
    }
    setSizesError(null);
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
          tags: tagNames.map((name) => ({ id: "", name, slug: name.toLowerCase().replace(/\s+/g, "-") })),
        },
        sizes,
      );
    } finally {
      setSaving(false);
    }
  };

  const cropReady = Boolean(form.cropConfig && isBeadCropConfigValid(form.cropConfig));
  const inheritTypeDefaults = Boolean(
    (form.metadata as { useTypeStrandDefaults?: boolean; strandRenderOverride?: unknown } | undefined)
      ?.useTypeStrandDefaults !== false &&
      (form.metadata as { strandRenderOverride?: unknown } | undefined)?.strandRenderOverride == null,
  );
  const subTypesForSelectedType = useMemo(
    () =>
      cat.subBeadTypes
        .filter((s) => s.beadTypeId === form.beadTypeId && s.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [cat.subBeadTypes, form.beadTypeId],
  );

  const renderCatalogue = useMemo(
    () => ({ beadTypes: cat.beadTypes, subBeadTypes: cat.subBeadTypes, strandRenderDefaults: cat.strandRenderDefaults }),
    [cat.beadTypes, cat.subBeadTypes, cat.strandRenderDefaults],
  );
  const resolvedStrand = useMemo(
    () => resolveStrandRenderConfigForBead(form, renderCatalogue),
    [form, renderCatalogue],
  );
  const inheritedSubTypeStrand = useMemo(
    () => resolveStrandRenderConfigForSubBeadType(form.subBeadTypeId, renderCatalogue),
    [form.subBeadTypeId, renderCatalogue],
  );
  const [showStrandAdvanced, setShowStrandAdvanced] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <h3 className="type-h3 text-base">Basic information</h3>
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
              onChange={(e) => {
                const nextTypeId = e.target.value;
                const nextSub =
                  cat.subBeadTypes.find((s) => s.beadTypeId === nextTypeId && s.isActive !== false) ??
                  cat.subBeadTypes.find((s) => s.beadTypeId === nextTypeId);
                setForm((f) => ({
                  ...f,
                  beadTypeId: nextTypeId,
                  subBeadTypeId: nextSub?.id ?? f.subBeadTypeId,
                }));
              }}
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
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Sub-type *</label>
            <select
              required
              value={form.subBeadTypeId}
              onChange={(e) => set("subBeadTypeId", e.target.value)}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {subTypesForSelectedType.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Availability status</span>
            <select
              value={form.availabilityStatusCode ?? (form.isActive === false ? "INACTIVE" : "ACTIVE")}
              onChange={(e) => {
                const code = e.target.value;
                set("availabilityStatusCode", code);
                const status = cat.beadAvailabilityStatuses.find((s) => s.code === code);
                if (status) set("isActive", status.showInBuilder);
              }}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {cat.beadAvailabilityStatuses.map((status) => (
                <option key={status.code} value={status.code}>
                  {status.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              {cat.beadAvailabilityStatuses.find(
                (s) => s.code === (form.availabilityStatusCode ?? (form.isActive === false ? "INACTIVE" : "ACTIVE")),
              )?.description ?? ""}
            </span>
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
        <BeadTagsField allTags={cat.beadTags} value={tagNames} onChange={setTagNames} />
      </section>

      <section className="space-y-4">
        <h3 className="type-h3 text-base">Images</h3>
        <div className="flex items-center gap-4 rounded-md border border-border bg-muted/20 p-3">
          <label className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 hover:bg-muted">
            {originalUrl ? (
              <img src={originalUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="absolute inset-0 opacity-0" onChange={handleUpload} disabled={uploading} />
          </label>
          <p className="text-xs text-muted-foreground">
            Upload a clear photo of the bead, then refine the outline in the editor below. Status:{" "}
            <span className={cropReady ? "text-status-success" : "text-status-warning"}>
              {cropReady ? "Ready" : form.cropStatus === "ready" ? "Ready" : "Draft"}
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
              <>
                <BeadCropEditor
                  key={`${beadCropEditorPlateKey(originalUrl, form.cropConfig)}|s${cropEditSession}`}
                  originalUrl={originalUrl}
                  initialCrop={draftCropRef.current ?? form.cropConfig ?? undefined}
                  libraryId={form.id || undefined}
                  enabledSizeMms={enabledSizeMms}
                  beadSizes={cat.beadSizes}
                  existingOffers={existingOffers}
                  onDraftChange={handleCropDraft}
                  onSaveCrop={handleSaveCrop}
                  onProcessedUpload={handleProcessed}
                  onBeforeNormalizedExport={async () => {
                    if (!form.id) return;
                    await beadLibrarySizesApi.recalculateNormalization(form.id);
                    const offers = await beadLibrarySizesApi.list(form.id);
                    cat.patchBeadLibrarySizes(form.id, offers);
                  }}
                  onNormalizedExportsSaved={() => {
                    if (!form.id) return;
                    void beadLibrarySizesApi.list(form.id).then((offers) => {
                      cat.patchBeadLibrarySizes(form.id, offers);
                    });
                  }}
                />
                {developerMode ? (
                  <>
                    <BeadAssetValidationPanel
                      bead={form}
                      draftConfig={draftCropRef.current ?? form.cropConfig}
                    />
                    {isBeadCropConfigValid(draftCropRef.current ?? form.cropConfig) ? (
                      <NormalizedExportDebugPanel
                        beadName={form.name}
                        cropConfig={(draftCropRef.current ?? form.cropConfig)!}
                        enabledSizeMms={enabledSizeMms}
                        beadSizes={cat.beadSizes}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
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

      <StrandRenderConfigPanel
        mode="bead"
        value={resolvedStrand}
        provenance={resolvedStrand.provenance}
        inheritTypeDefaults={inheritTypeDefaults}
        showAdvanced={showStrandAdvanced}
        previewImageUrl={form.processedImage?.trim() || form.image?.trim() || originalUrl || null}
        onInheritTypeDefaultsChange={(inherit) => setForm((f) => setInheritTypeDefaults(f, inherit))}
        onChange={(patch) => setForm((f) => updateStrandOverride(f, patch, inheritedSubTypeStrand))}
        onResetToType={() => setForm((f) => setInheritTypeDefaults(f, true))}
        onResetToSystem={() =>
          setForm((f) => {
            const system = cat.strandRenderDefaults ?? DEFAULT_STRAND_RENDER_PROFILE;
            const override = pruneStrandRenderOverride(system, inheritedSubTypeStrand);
            if (strandRenderOverrideIsEmpty(override)) {
              return setInheritTypeDefaults(f, true);
            }
            return {
              ...f,
              metadata: {
                ...(f.metadata ?? {}),
                useTypeStrandDefaults: false,
                strandRenderOverride: override,
              },
            };
          })
        }
      />

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowStrandAdvanced((v) => !v)}>
          {showStrandAdvanced ? "Hide advanced appearance" : "Advanced appearance"}
        </Button>
      </div>

      <section ref={sizesSectionRef} className="space-y-3">
        <h3 className="type-h3 text-base">Available sizes</h3>
        {sizesError ? <p className="text-xs text-destructive">{sizesError}</p> : null}
        <BeadLibrarySizesPanel
          rows={sizeRows}
          onRowsChange={(rows) => {
            setSizeRows(rows);
            setSizesError(null);
          }}
        />
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
