import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  normalizeSubBeadTypeStrandMetadata,
  partialStrandOverrideFromMetadata,
  patchStrandCustomizedFields,
  resolveStrandRenderConfig,
  resolvedTypeStrandProfile,
  setStrandFieldGroupCustomized,
  strandRenderCustomizedFields,
  parseStrandRenderProfile,
  type StrandRenderFieldGroup,
} from "@bino-foundry/shared/types";
import { useCatalogue } from "@/state/catalogue";

import {
  ADMIN_UNSAVED_COPY,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "../unsaved-changes";
import { adminFieldClass } from "./admin-styles";
import { AdminActiveInactiveStatusField } from "./AdminActiveInactiveStatusField";
import { StrandRenderConfigPanel } from "./StrandRenderConfigPanel";

interface SubBeadTypeFormProps {
  beadType: BeadTypeEntry;
  initial?: SubBeadTypeEntry;
  onSave: (entry: SubBeadTypeEntry) => void | Promise<void>;
  onCancel: () => void;
}

function clearStrandCustomizations(form: SubBeadTypeEntry): SubBeadTypeEntry {
  const meta = { ...(form.metadata ?? {}) } as Record<string, unknown>;
  delete meta.strandRenderCustomizedFields;
  delete meta.strandRenderOverride;
  return { ...form, metadata: meta };
}

export function SubBeadTypeForm({ beadType, initial, onSave, onCancel }: SubBeadTypeFormProps) {
  const { strandRenderDefaults, beadLibraries } = useCatalogue();
  const blank: SubBeadTypeEntry = {
    id: "",
    beadTypeId: beadType.id,
    slug: "",
    name: "",
    description: "",
    displayOrder: 0,
    isActive: true,
    metadata: {},
  };
  const [form, setForm] = useState<SubBeadTypeEntry>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const dirtySnapshot = useMemo(() => form, [form]);
  const { isDirty, markClean } = useDirtySnapshot(dirtySnapshot, initial?.id ?? "new");
  const { confirmLeave, clearDirtySync } = useUnsavedChangesGuard(isDirty);

  const customizedFields = strandRenderCustomizedFields(form.metadata);

  const inheritedBeadTypeProfile = useMemo(() => {
    const typeMeta = beadType.metadata as { strandRender?: unknown } | undefined;
    return resolvedTypeStrandProfile(
      parseStrandRenderProfile(typeMeta?.strandRender),
      strandRenderDefaults,
    );
  }, [beadType.metadata, strandRenderDefaults]);

  const effective = useMemo(() => {
    return resolveStrandRenderConfig({
      systemDefaults: strandRenderDefaults,
      beadTypeDefaults: parseStrandRenderProfile(
        (beadType.metadata as { strandRender?: unknown } | undefined)?.strandRender,
      ),
      subBeadTypePartialOverride: partialStrandOverrideFromMetadata(form.metadata),
    });
  }, [form.metadata, beadType.metadata, strandRenderDefaults]);

  const previewSampleBead = useMemo(() => {
    const subId = form.id || initial?.id;
    const bySub = subId
      ? beadLibraries.find((b) => b.subBeadTypeId === subId)
      : undefined;
    const byType = beadLibraries.find((b) => b.beadTypeId === beadType.id);
    return bySub ?? byType ?? null;
  }, [beadLibraries, form.id, initial?.id, beadType.id]);

  const previewImageUrl = useMemo(() => {
    const sample = previewSampleBead;
    return sample?.processedImage?.trim() || sample?.image?.trim() || null;
  }, [previewSampleBead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const normalizedMetadata = normalizeSubBeadTypeStrandMetadata(
        form.metadata ?? {},
        inheritedBeadTypeProfile,
      );
      markClean();
      clearDirtySync();
      await onSave({ ...form, beadTypeId: beadType.id, metadata: normalizedMetadata });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Under <span className="font-medium text-foreground">{beadType.name}</span>
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
          <input
            required
            className={adminFieldClass()}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Quartz, Zodiac"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            className={adminFieldClass()}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Display order</label>
            <input
              type="number"
              className={adminFieldClass()}
              value={form.displayOrder ?? 0}
              onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
            />
          </div>
          <AdminActiveInactiveStatusField
            value={form.isActive}
            onChange={(isActive) => setForm({ ...form, isActive })}
            hint="Inactive sub-types are hidden from the bracelet builder."
          />
        </div>
        {initial?.slug ? (
          <p className="font-mono text-[10px] text-muted-foreground">Slug: {initial.slug}</p>
        ) : null}
      </div>

      <StrandRenderConfigPanel
        mode="subBeadType"
        value={effective}
        provenance={effective.provenance}
        customizedFields={customizedFields}
        onFieldCustomizeChange={(group: StrandRenderFieldGroup, enabled: boolean) =>
          setForm((prev) => ({
            ...prev,
            metadata: setStrandFieldGroupCustomized(
              prev.metadata,
              group,
              enabled,
              effective,
            ),
          }))
        }
        showAdvanced={showAdvanced}
        previewImageUrl={previewImageUrl}
        previewSampleBead={previewSampleBead}
        onChange={(patch) =>
          setForm((prev) => ({
            ...prev,
            metadata: patchStrandCustomizedFields(prev.metadata, patch),
          }))
        }
        onResetToType={() => setForm((prev) => clearStrandCustomizations(prev))}
        onResetToSystem={() => setForm((prev) => clearStrandCustomizations(prev))}
      />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
        Show advanced rendering fields
      </label>

      <div className="flex gap-2">
        {isDirty ? (
          <p className="mr-auto self-center text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save sub-type"}
        </Button>
        <Button type="button" variant="outline" onClick={() => confirmLeave(onCancel)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
