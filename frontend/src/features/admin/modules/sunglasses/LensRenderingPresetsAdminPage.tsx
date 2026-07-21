import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  pickLensRenderPresetSettings,
  type LensClipRenderSettings,
  type LensRenderingPreset,
} from "@bino-foundry/shared/types";

import { AdminDeleteConfirm } from "@/features/admin/components/AdminDeleteConfirm";
import { LensRenderingSettingsPanel } from "@/features/admin/components/LensRenderingSettingsPanel";
import { LensRenderPresetLivePreview } from "@/features/admin/components/LensRenderPresetLivePreview";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common";
import { ErrorState } from "@/components/common";
import { isApiError } from "@/services/api";
import { sunglassesApi } from "@/services/api/sunglasses";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";
import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";

function blankPreset(): Omit<LensRenderingPreset, "id" | "createdAt" | "updatedAt"> {
  return {
    code: "",
    name: "",
    description: "",
    settings: { ...LENS_RENDER_SYSTEM_DEFAULTS },
    displayOrder: 0,
    isActive: true,
    isDefault: false,
  };
}

function slugifyCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function LensRenderingPresetsAdminPage() {
  const catalog = useSunglassesCatalog();
  const [presets, setPresets] = useState<LensRenderingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    (Partial<LensRenderingPreset> & { settings: LensClipRenderSettings }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewTintHex, setPreviewTintHex] = useState("#8F1830");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await sunglassesApi.listLensRenderPresets();
      setPresets(list);
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
        (p) => p.isActive || p.isSystem || p.id === editing?.id || p.id === confirmDeleteId,
      ),
    [presets, editing?.id, confirmDeleteId],
  );

  const draftSettings = useMemo(() => {
    if (!editing) return { ...DEFAULT_LENS_CLIP_RENDER };
    return {
      ...DEFAULT_LENS_CLIP_RENDER,
      ...pickLensRenderPresetSettings(editing.settings),
    };
  }, [editing]);

  const openEdit = (preset: LensRenderingPreset) => {
    setSaveFeedback(null);
    setEditing({
      ...preset,
      settings: {
        ...LENS_RENDER_SYSTEM_DEFAULTS,
        ...pickLensRenderPresetSettings(preset.settings),
      },
    });
  };

  const handleSave = async () => {
    if (!editing?.name?.trim()) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const code = editing.code?.trim() || slugifyCode(editing.name);
      const payload = {
        code,
        name: editing.name.trim(),
        description: editing.description?.trim() ?? "",
        settings: pickLensRenderPresetSettings(editing.settings),
        displayOrder: editing.displayOrder ?? 0,
        isActive: editing.isActive !== false,
        isDefault: Boolean(editing.isDefault),
      };

      if (editing.id) {
        await sunglassesApi.updateLensRenderPreset(editing.id, payload);
        setSaveFeedback("Saved");
      } else {
        const created = await sunglassesApi.createLensRenderPreset(payload);
        setEditing({
          ...created,
          settings: {
            ...LENS_RENDER_SYSTEM_DEFAULTS,
            ...pickLensRenderPresetSettings(created.settings),
          },
        });
        setSaveFeedback("Created");
      }
      await refresh();
      window.setTimeout(() => setSaveFeedback(null), 2000);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await sunglassesApi.duplicateLensRenderPreset(id);
      await refresh();
      openEdit(copy);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to duplicate preset");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sunglassesApi.deleteLensRenderPreset(id);
      setConfirmDeleteId(null);
      if (editing?.id === id) setEditing(null);
      await refresh();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to delete preset");
      setConfirmDeleteId(null);
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
            Four built-in starting points (Clear, Light Tint, Classic Tint, Dark Tint). Edit any
            preset freely; create more later if needed. Built-in presets cannot be deleted.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing({ ...blankPreset(), settings: { ...LENS_RENDER_SYSTEM_DEFAULTS } });
            setSaveFeedback(null);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New preset
        </Button>
      </div>

      {error ? (
        <p className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive sm:px-6">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-scroll-pane border-b border-border lg:border-b-0 lg:border-r">
          <ul className="divide-y divide-border">
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
                      {preset.code}
                      {preset.isSystem ? " · Built-in" : ""}
                      {preset.isDefault ? " · Default" : ""}
                      {!preset.isActive ? " · Inactive" : ""}
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
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Duplicate"
                      onClick={() => void handleDuplicate(preset.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title={preset.isSystem ? "Built-in presets cannot be deleted" : "Delete"}
                      disabled={Boolean(preset.isSystem) || preset.isDefault}
                      onClick={() => setConfirmDeleteId(preset.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {confirmDeleteId === preset.id ? (
                  <div className="px-3 pb-3">
                    <AdminDeleteConfirm
                      onConfirm={() => void handleDelete(preset.id)}
                      onCancel={() => setConfirmDeleteId(null)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>

        <div className="admin-scroll-pane min-h-0 p-4 sm:p-6">
          {!editing ? (
            <p className="text-sm text-muted-foreground">
              Select a preset to edit, or create a new one. Slider changes update the live preview
              immediately — Save commits to the database.
            </p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="grid gap-3">
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
                                code: prev.id ? prev.code : slugifyCode(e.target.value),
                              }
                            : prev,
                        )
                      }
                      placeholder="e.g. Dark Sunglasses"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">Code</span>
                    <input
                      className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm"
                      value={editing.code ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => (prev ? { ...prev, code: e.target.value } : prev))
                      }
                      disabled={Boolean(editing.id) || Boolean(editing.isSystem)}
                    />
                    {editing.isSystem ? (
                      <p className="text-[10px] text-muted-foreground">
                        Built-in preset code is fixed; you can still rename and edit values.
                      </p>
                    ) : null}
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-medium text-foreground">Description</span>
                    <textarea
                      className="min-h-[60px] w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                      value={editing.description ?? ""}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev ? { ...prev, description: e.target.value } : prev,
                        )
                      }
                    />
                  </label>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editing.isActive !== false}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev ? { ...prev, isActive: e.target.checked } : prev,
                          )
                        }
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(editing.isDefault)}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev ? { ...prev, isDefault: e.target.checked } : prev,
                          )
                        }
                      />
                      Default for new frames
                    </label>
                  </div>
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
                  <Button type="button" disabled={saving || !editing.name?.trim()} onClick={() => void handleSave()}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <LensRenderPresetLivePreview
                draftSettings={draftSettings}
                previewTintHex={previewTintHex}
                onPreviewTintChange={setPreviewTintHex}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
