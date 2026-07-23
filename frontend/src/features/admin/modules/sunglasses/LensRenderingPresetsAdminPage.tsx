import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Settings2 } from "lucide-react";
import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  pickLensRenderPresetSettings,
  type LensClipRenderSettings,
  type LensRenderingPreset,
} from "@bino-foundry/shared/types";

import { LensRenderingSettingsPanel } from "@/features/admin/components/LensRenderingSettingsPanel";
import { LensRenderPresetLivePreview } from "@/features/admin/components/LensRenderPresetLivePreview";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common";
import { ErrorState } from "@/components/common";
import { isApiError } from "@/services/api";
import { sunglassesApi } from "@/services/api/sunglasses";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";
import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";

export function LensRenderingPresetsAdminPage() {
  const catalog = useSunglassesCatalog();
  const [presets, setPresets] = useState<LensRenderingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    (Partial<LensRenderingPreset> & { settings: LensClipRenderSettings }) | null
  >(null);
  const [editingSystemDefault, setEditingSystemDefault] = useState(false);
  const [systemDefaults, setSystemDefaults] = useState<LensClipRenderSettings>({
    ...LENS_RENDER_SYSTEM_DEFAULTS,
  });
  const [saving, setSaving] = useState(false);
  const [previewTintHex, setPreviewTintHex] = useState("#8F1830");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, defaults] = await Promise.all([
        sunglassesApi.listLensRenderPresets(),
        sunglassesApi.getLensRenderSystemDefaults(),
      ]);
      setPresets(list);
      setSystemDefaults({
        ...LENS_RENDER_SYSTEM_DEFAULTS,
        ...pickLensRenderPresetSettings(defaults),
      });
      await catalog.refreshAdminFromApi();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load lens rendering presets");
    } finally {
      setLoading(false);
    }
  }, [catalog.refreshAdminFromApi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visiblePresets = useMemo(
    () =>
      presets.filter(
        (p) => p.isActive && p.isSystem,
      ),
    [presets],
  );

  const draftSettings = useMemo(() => {
    if (!editing) return { ...DEFAULT_LENS_CLIP_RENDER, ...systemDefaults };
    return {
      ...DEFAULT_LENS_CLIP_RENDER,
      ...systemDefaults,
      ...pickLensRenderPresetSettings(editing.settings),
    };
  }, [editing, systemDefaults]);

  const openEdit = (preset: LensRenderingPreset) => {
    setSaveFeedback(null);
    setEditingSystemDefault(false);
    setEditing({
      ...preset,
      settings: {
        ...systemDefaults,
        ...pickLensRenderPresetSettings(preset.settings),
      },
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editingSystemDefault && !editing.name?.trim()) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      if (editingSystemDefault) {
        const saved = await sunglassesApi.updateLensRenderSystemDefaults(
          pickLensRenderPresetSettings(editing.settings),
        );
        setSystemDefaults({
          ...LENS_RENDER_SYSTEM_DEFAULTS,
          ...pickLensRenderPresetSettings(saved),
        });
        setEditing((prev) => (prev ? { ...prev, settings: saved } : prev));
        setSaveFeedback("Saved");
        await catalog.refreshAdminFromApi();
        window.setTimeout(() => setSaveFeedback(null), 2000);
        return;
      }
      const payload = {
        code: editing.code!,
        name: editing.name.trim(),
        description: editing.description?.trim() ?? "",
        settings: pickLensRenderPresetSettings(editing.settings),
        displayOrder: editing.displayOrder ?? 0,
        isActive: editing.isActive !== false,
        isDefault: Boolean(editing.isDefault),
      };

      await sunglassesApi.updateLensRenderPreset(editing.id!, payload);
      setSaveFeedback("Saved");
      await refresh();
      window.setTimeout(() => setSaveFeedback(null), 2000);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  if (loading && presets.length === 0) {
    return <LoadingState label="Loading lens rendering presets…" className="h-64" />;
  }

  if (error && presets.length === 0 && !editing) {
    return <ErrorState message={error} onRetry={() => void refresh()} className="m-6" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Lens Rendering Presets</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Configure glass material layers applied over the original lens. Hierarchy: Frame
            Override → Preset → System Default. Live preview matches customer rendering exactly.
          </p>
        </div>
      </div>

      {error ? (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive sm:px-6">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-scroll-pane border-b border-border lg:border-b-0 lg:border-r">
          <ul className="divide-y divide-border">
            <li>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-3 text-left ${
                  editingSystemDefault ? "bg-muted/50" : ""
                }`}
                onClick={() => {
                  setEditingSystemDefault(true);
                  setEditing({ name: "System Default", settings: { ...systemDefaults } });
                  setSaveFeedback(null);
                }}
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-foreground">System Default</span>
                  <span className="block text-[11px] text-muted-foreground">Global fallback</span>
                </span>
              </button>
            </li>
            {visiblePresets.map((preset) => (
              <li key={preset.id}>
                <div
                  className={`flex items-start gap-2 px-3 py-3 ${
                    editing?.id === preset.id ? "bg-muted/50" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => openEdit(preset)}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{preset.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Database preset
                      {preset.isDefault ? " · Default" : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={() => openEdit(preset)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="admin-scroll-pane min-h-0 p-4 sm:p-6">
          {!editing ? (
            <p className="text-sm text-muted-foreground">
              Select System Default or a preset. Settings update the live preview immediately;
              Save persists them for frames that use this material.
            </p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="grid gap-3">
                  {!editingSystemDefault ? (
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">Name</span>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.name ?? ""}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                name: e.target.value,
                              }
                            : prev,
                        )
                      }
                      placeholder="e.g. Dark Sunglasses"
                    />
                  </label>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-foreground">System Default</p>
                      <p className="text-xs text-muted-foreground">
                        Ultimate fallback for every rendering property.
                      </p>
                    </div>
                  )}
                </div>

                <LensRenderingSettingsPanel
                  value={editing.settings}
                  onChange={(settings) =>
                    setEditing((prev) => (prev ? { ...prev, settings } : prev))
                  }
                />

                <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                  {saveFeedback ? (
                    <span className="mr-auto text-xs text-muted-foreground">{saveFeedback}</span>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || (!editingSystemDefault && !editing.name?.trim())}
                    onClick={() => void handleSave()}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                <LensRenderPresetLivePreview
                  draftSettings={draftSettings}
                  systemDefaults={systemDefaults}
                  previewTintHex={previewTintHex}
                  onPreviewTintChange={setPreviewTintHex}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
