import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BeadTypeEntry } from "@/types/beads";
import {
  beadLibraryInheritsTypeStrandDefaults,
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  resolveStrandRenderConfig,
} from "@bino-foundry/shared/types";
import { strandRenderMigrationApi } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";

import { adminFieldClass } from "./admin-styles";
import { AdminActiveInactiveStatusField } from "./AdminActiveInactiveStatusField";
import { StrandRenderConfigPanel } from "./StrandRenderConfigPanel";

interface BeadTypeFormProps {
  initial?: BeadTypeEntry;
  onSave: (entry: BeadTypeEntry) => void | Promise<void>;
  onCancel: () => void;
}

function typePartialFromForm(form: BeadTypeEntry) {
  const meta = form.metadata as { strandRender?: unknown } | undefined;
  return parseStrandRenderProfile(meta?.strandRender);
}

function updateTypeStrandRender(form: BeadTypeEntry, patch: Record<string, unknown>): BeadTypeEntry {
  const current = mergeStrandRenderProfile(typePartialFromForm(form), patch);
  return {
    ...form,
    metadata: { ...(form.metadata ?? {}), strandRender: current },
  };
}

export function BeadTypeForm({ initial, onSave, onCancel }: BeadTypeFormProps) {
  const { strandRenderDefaults, refreshFromApi, beadLibraries } = useCatalogue();
  const blank: BeadTypeEntry = {
    id: "",
    slug: "",
    name: "",
    description: "",
    displayOrder: 0,
    isActive: true,
  };
  const [form, setForm] = useState<BeadTypeEntry>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Same System → Type resolve the Builder uses for beads that inherit this type.
  const effective = useMemo(() => {
    return resolveStrandRenderConfig({
      systemDefaults: strandRenderDefaults,
      beadTypeDefaults: typePartialFromForm(form),
    });
  }, [form, strandRenderDefaults]);

  const typeLibraryBeads = useMemo(() => {
    const typeId = form.id || initial?.id;
    return beadLibraries.filter(
      (b) =>
        (typeId && b.beadTypeId === typeId) ||
        (form.slug && b.beadTypeSlug === form.slug),
    );
  }, [beadLibraries, form.id, form.slug, initial?.id]);

  const overriddenBeadCount = useMemo(
    () => typeLibraryBeads.filter((b) => !beadLibraryInheritsTypeStrandDefaults(b.metadata)).length,
    [typeLibraryBeads],
  );

  const previewImageUrl = useMemo(() => {
    const inheriting = typeLibraryBeads.find((b) => beadLibraryInheritsTypeStrandDefaults(b.metadata));
    const sample = inheriting ?? typeLibraryBeads[0];
    return sample?.processedImage?.trim() || sample?.image?.trim() || null;
  }, [typeLibraryBeads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
          <input
            required
            className={adminFieldClass()}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Natural stone"
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
            hint="Inactive types are hidden from the bracelet builder."
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enableSubTypes === true}
            onChange={(e) => setForm({ ...form, enableSubTypes: e.target.checked })}
          />
          Sub-type tabs in builder
        </label>
        {initial?.slug ? (
          <p className="font-mono text-[10px] text-muted-foreground">Slug: {initial.slug}</p>
        ) : null}
      </div>

      <StrandRenderConfigPanel
        mode="beadType"
        value={effective}
        provenance={effective.provenance}
        showAdvanced={showAdvanced}
        previewImageUrl={previewImageUrl}
        onChange={(patch) => setForm((f) => updateTypeStrandRender(f, patch))}
        onResetToSystem={() =>
          setForm((f) => ({
            ...f,
            metadata: {
              ...(f.metadata ?? {}),
              strandRender: strandRenderDefaults ?? DEFAULT_STRAND_RENDER_PROFILE,
            },
          }))
        }
      />

      {initial?.id ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">Bulk actions for beads of this type:</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkBusy != null}
              onClick={async () => {
                setBulkBusy("apply");
                setBulkMessage(null);
                try {
                  const result = await strandRenderMigrationApi.applyTypeToLibraries(initial.id);
                  await refreshFromApi();
                  setBulkMessage(`Reset ${result.updated} bead(s) to inherit this type.`);
                } catch {
                  setBulkMessage("Could not apply type defaults to beads.");
                } finally {
                  setBulkBusy(null);
                }
              }}
            >
              {bulkBusy === "apply" ? "Applying…" : "Apply type defaults to existing beads"}
            </Button>
          </div>
          {overriddenBeadCount > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {overriddenBeadCount} bead(s) have individual overrides and will not pick up type
              changes until you apply type defaults (or clear each bead override).
            </p>
          ) : null}
        </div>
      ) : null}
      {bulkMessage ? <p className="text-xs text-muted-foreground">{bulkMessage}</p> : null}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save type"}
          </Button>
        </div>
      </div>
    </form>
  );
}
