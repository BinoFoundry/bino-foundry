import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BeadTypeEntry } from "@/types/beads";
import {
  beadLibraryInheritsTypeStrandDefaults,
  DEFAULT_STRAND_RENDER_PROFILE,
  parseStrandRenderProfile,
  pruneStrandRenderOverride,
  resolveStrandRenderConfig,
  strandRenderOverrideIsEmpty,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";
import { strandRenderMigrationApi } from "@/services/api";
import { useCatalogue } from "@/state/catalogue";

import {
  ADMIN_UNSAVED_COPY,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "../unsaved-changes";
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

function systemProfile(strandRenderDefaults: StrandRenderProfile | null): StrandRenderProfile {
  return strandRenderDefaults ?? DEFAULT_STRAND_RENDER_PROFILE;
}

/**
 * Store only type-tier diffs vs system.
 * Baking a full DEFAULT profile into every type made all types look identical in the Builder
 * when editors only changed ignored fields (contact width / layout scale).
 */
function updateTypeStrandRender(
  form: BeadTypeEntry,
  patch: Partial<StrandRenderProfile>,
  strandRenderDefaults: StrandRenderProfile | null,
): BeadTypeEntry {
  const system = systemProfile(strandRenderDefaults);
  const current = typePartialFromForm(form) ?? {};
  const resolved = { ...system, ...current, ...patch };
  const pruned = pruneStrandRenderOverride(resolved, system);
  const metadata = { ...(form.metadata ?? {}) } as Record<string, unknown>;
  if (strandRenderOverrideIsEmpty(pruned)) {
    delete metadata.strandRender;
  } else {
    metadata.strandRender = pruned;
  }
  return { ...form, metadata };
}

function normalizeTypeStrandMetadata(
  form: BeadTypeEntry,
  strandRenderDefaults: StrandRenderProfile | null,
): BeadTypeEntry {
  return updateTypeStrandRender(form, {}, strandRenderDefaults);
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
  const [resetBeadsOnSave, setResetBeadsOnSave] = useState(true);

  const dirtySnapshot = useMemo(
    () => ({ form, resetBeadsOnSave }),
    [form, resetBeadsOnSave],
  );
  const { isDirty, markClean } = useDirtySnapshot(dirtySnapshot, initial?.id ?? "new");
  const { confirmLeave, clearDirtySync } = useUnsavedChangesGuard(isDirty);

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

  const previewSampleBead = useMemo(() => {
    const inheriting = typeLibraryBeads.find((b) => beadLibraryInheritsTypeStrandDefaults(b.metadata));
    return inheriting ?? typeLibraryBeads[0] ?? null;
  }, [typeLibraryBeads]);

  const previewImageUrl = useMemo(() => {
    const sample = previewSampleBead;
    return sample?.processedImage?.trim() || sample?.image?.trim() || null;
  }, [previewSampleBead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    setBulkMessage(null);
    try {
      const normalized = normalizeTypeStrandMetadata(form, strandRenderDefaults);
      markClean();
      clearDirtySync();
      await onSave(normalized);
      if (initial?.id && resetBeadsOnSave && overriddenBeadCount > 0) {
        const result = await strandRenderMigrationApi.applyTypeToLibraries(initial.id);
        await refreshFromApi();
        setBulkMessage(
          `Saved. Reset ${result.updated} bead(s) to inherit this type so the Builder picks up the new defaults.`,
        );
      }
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
        previewSampleBead={previewSampleBead}
        onChange={(patch) =>
          setForm((f) => updateTypeStrandRender(f, patch, strandRenderDefaults))
        }
        onResetToSystem={() =>
          setForm((f) => {
            const metadata = { ...(f.metadata ?? {}) } as Record<string, unknown>;
            delete metadata.strandRender;
            return { ...f, metadata };
          })
        }
      />

      {initial?.id ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
          {overriddenBeadCount > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {overriddenBeadCount} bead(s) of this type have individual overrides. The Bracelet
              Builder will keep those old values until beads inherit this type again.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              All beads of this type inherit these defaults in the Bracelet Builder.
            </p>
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={resetBeadsOnSave}
              onChange={(e) => setResetBeadsOnSave(e.target.checked)}
              disabled={overriddenBeadCount === 0}
            />
            <span>
              On save, reset beads of this type to inherit these defaults
              {overriddenBeadCount > 0 ? ` (${overriddenBeadCount} overridden)` : ""}. Required for
              Builder to match Admin when beads were customized.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkBusy != null || overriddenBeadCount === 0}
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
              {bulkBusy === "apply" ? "Applying…" : "Apply type defaults now"}
            </Button>
          </div>
        </div>
      ) : null}
      {bulkMessage ? <p className="text-xs text-muted-foreground">{bulkMessage}</p> : null}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </Button>
        <div className="flex gap-2">
          {isDirty ? (
            <p className="mr-auto self-center text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => confirmLeave(onCancel)}
            disabled={saving}
          >
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
