import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { settingsApi } from "@/services/api/settings";
import { useCatalogue } from "@/state/catalogue";
import { DEFAULT_STRAND_RENDER_PROFILE, type StrandRenderProfile } from "@bino-foundry/shared/types";
import {
  notifyAdminSaveFailed,
  notifyAdminSavedEdit,
} from "@/features/admin/lib/admin-save-feedback";
import {
  ADMIN_UNSAVED_COPY,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "@/features/admin/unsaved-changes";

import { StrandRenderConfigPanel } from "../../components/StrandRenderConfigPanel";

interface StrandRenderDefaultsAdminProps {
  embedded?: boolean;
  onRegisterReload?: (reload: () => Promise<void>) => void;
}

export function StrandRenderDefaultsAdmin({
  embedded = false,
  onRegisterReload,
}: StrandRenderDefaultsAdminProps) {
  const { strandRenderDefaults, updateStrandRenderDefaults, beadLibraries } = useCatalogue();
  const [value, setValue] = useState<StrandRenderProfile>(
    strandRenderDefaults ?? DEFAULT_STRAND_RENDER_PROFILE,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrateKey, setHydrateKey] = useState(0);
  const loadedRef = useRef(false);

  const dirtySnapshot = useMemo(() => value, [value]);
  const { isDirty } = useDirtySnapshot(dirtySnapshot, hydrateKey);
  useUnsavedChangesGuard(!loading && isDirty);

  const previewSampleBead = useMemo(() => {
    const withImage = beadLibraries.find(
      (b) => Boolean(b.processedImage?.trim() || b.image?.trim()),
    );
    return withImage ?? beadLibraries[0] ?? null;
  }, [beadLibraries]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const defaults = strandRenderDefaults ?? (await settingsApi.getStrandRenderDefaults());
      setValue(defaults);
      setHydrateKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strand defaults");
    } finally {
      setLoading(false);
    }
  }, [strandRenderDefaults]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void load();
  }, [load]);

  useEffect(() => {
    onRegisterReload?.(load);
  }, [load, onRegisterReload]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateStrandRenderDefaults(value);
      setValue(saved);
      setHydrateKey((k) => k + 1);
      notifyAdminSavedEdit();
    } catch (err) {
      notifyAdminSaveFailed(err);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading strand defaults…</p>;
  }

  return (
    <div className={embedded ? "space-y-4" : "mx-auto max-w-2xl space-y-4 p-4"}>
      {!embedded ? <h2 className="type-h2 text-lg">Bracelet rendering defaults</h2> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <StrandRenderConfigPanel
        mode="system"
        value={value}
        showAdvanced={showAdvanced}
        previewSampleBead={previewSampleBead}
        onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        {isDirty ? (
          <p className="mr-auto text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save strand defaults"}
        </Button>
      </div>
    </div>
  );
}
