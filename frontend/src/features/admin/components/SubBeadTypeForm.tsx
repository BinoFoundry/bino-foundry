import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeLazyStrandRenderOverride,
  normalizeSubBeadTypeStrandMetadata,
  parseStrandRenderProfile,
  pruneStrandRenderOverride,
  resolvedTypeStrandProfile,
  resolveStrandRenderConfig,
  strandRenderOverrideIsEmpty,
  subBeadTypeInheritsBeadTypeStrandDefaults,
} from "@bino-foundry/shared/types";
import { useCatalogue } from "@/state/catalogue";

import { adminFieldClass } from "./admin-styles";
import { AdminActiveInactiveStatusField } from "./AdminActiveInactiveStatusField";
import { StrandRenderConfigPanel } from "./StrandRenderConfigPanel";

interface SubBeadTypeFormProps {
  beadType: BeadTypeEntry;
  initial?: SubBeadTypeEntry;
  onSave: (entry: SubBeadTypeEntry) => void | Promise<void>;
  onCancel: () => void;
}

function subTypeOverrideFromForm(form: SubBeadTypeEntry) {
  const meta = form.metadata as { strandRenderOverride?: unknown } | undefined;
  return parseStrandRenderProfile(meta?.strandRenderOverride);
}

function updateSubTypeStrandOverride(form: SubBeadTypeEntry, patch: Record<string, unknown>): SubBeadTypeEntry {
  const inherited = resolvedTypeStrandProfile(
    parseStrandRenderProfile((form.metadata as { strandRender?: unknown })?.strandRender),
  );
  const current = subTypeOverrideFromForm(form) ?? {};
  const next = mergeLazyStrandRenderOverride(current, patch, inherited);
  if (strandRenderOverrideIsEmpty(next)) {
    // Keep an explicit opt-out; only snap back to inherit when already inheriting.
    const keepOptOut = form.metadata?.useBeadTypeStrandDefaults === false;
    return setInheritBeadTypeDefaults(form, !keepOptOut);
  }
  return {
    ...form,
    metadata: {
      ...(form.metadata ?? {}),
      useBeadTypeStrandDefaults: false,
      strandRenderOverride: next,
    },
  };
}

function setInheritBeadTypeDefaults(form: SubBeadTypeEntry, inherit: boolean): SubBeadTypeEntry {
  const meta = { ...(form.metadata ?? {}) } as Record<string, unknown>;
  if (inherit) {
    delete meta.strandRenderOverride;
    meta.useBeadTypeStrandDefaults = true;
  } else {
    meta.useBeadTypeStrandDefaults = false;
  }
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
    metadata: { useBeadTypeStrandDefaults: true },
  };
  const [form, setForm] = useState<SubBeadTypeEntry>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const inheritBeadTypeDefaults = subBeadTypeInheritsBeadTypeStrandDefaults(form.metadata);

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
      subBeadTypeOverride: subTypeOverrideFromForm(form),
      inheritSubBeadTypeFromBeadType: inheritBeadTypeDefaults,
    });
  }, [form, beadType.metadata, strandRenderDefaults, inheritBeadTypeDefaults]);

  const previewImageUrl = useMemo(() => {
    const subId = form.id || initial?.id;
    const bySub = subId
      ? beadLibraries.find((b) => b.subBeadTypeId === subId)
      : undefined;
    const byType = beadLibraries.find((b) => b.beadTypeId === beadType.id);
    const sample = bySub ?? byType;
    return sample?.processedImage?.trim() || sample?.image?.trim() || null;
  }, [beadLibraries, form.id, initial?.id, beadType.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const normalizedMetadata = normalizeSubBeadTypeStrandMetadata(
        form.metadata ?? {},
        inheritedBeadTypeProfile,
      );
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
        inheritTypeDefaults={inheritBeadTypeDefaults}
        onInheritTypeDefaultsChange={(inherit) => setForm((prev) => setInheritBeadTypeDefaults(prev, inherit))}
        showAdvanced={showAdvanced}
        previewImageUrl={previewImageUrl}
        onChange={(patch) => setForm((prev) => updateSubTypeStrandOverride(prev, patch))}
        onResetToType={() => setForm((prev) => setInheritBeadTypeDefaults(prev, true))}
        onResetToSystem={() =>
          setForm((prev) => {
            const system = strandRenderDefaults ?? DEFAULT_STRAND_RENDER_PROFILE;
            const override = pruneStrandRenderOverride(subTypeOverrideFromForm(prev) ?? {}, system);
            if (strandRenderOverrideIsEmpty(override)) {
              return setInheritBeadTypeDefaults(prev, true);
            }
            return {
              ...prev,
              metadata: {
                ...(prev.metadata ?? {}),
                useBeadTypeStrandDefaults: false,
                strandRenderOverride: override,
              },
            };
          })
        }
      />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
        Show advanced rendering fields
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save sub-type"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
