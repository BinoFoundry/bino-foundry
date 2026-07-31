import { useEffect, useMemo, useState } from "react";

import type { LensClipRenderSettings } from "@bino-foundry/shared/types";

import { TintColorControl } from "@/features/admin/components/tint-editor/TintColorControl";
import { isValidHexColor } from "@/features/admin/lib/adminHex";
import { SunglassesCompositor } from "@/render/components/SunglassesCompositor";
import { buildCustomiserCompositorConfig } from "@/render/adapters/customiser-config";
import { isFrameViewClipReady } from "@/render/lens-clip";
import { useCatalogue } from "@/state/catalogue";
import type { FrameEntry } from "@/data/glasses";

function framesWithClipReady(frames: FrameEntry[]): FrameEntry[] {
  return frames.filter(
    (frame) =>
      frame.renderViews?.some((v) => v.view === "front" && v.plateUrl && isFrameViewClipReady(v)),
  );
}

/**
 * Heuristic darkness score for source-lens calibration defaults.
 * Higher = naturally darker original lens; lower = clearer.
 */
export function scoreSourceLensDarkness(frame: FrameEntry): number {
  const front = frame.renderViews?.find((v) => v.view === "front");
  const render = front?.clipConfig?.render;
  const calibrated =
    render?.darkLayerOpacity ??
    render?.baseGlassDarkness ??
    render?.glassBaseDensity;
  if (typeof calibrated === "number" && Number.isFinite(calibrated)) {
    return Math.max(0, Math.min(100, calibrated));
  }

  const name = `${frame.name} ${frame.description ?? ""}`.toLowerCase();
  let score = 50;
  if (/\b(dark|black|smoke|grey|gray|brown|tortoise|sunglass|opaque)\b/.test(name)) {
    score += 35;
  }
  if (/\b(clear|crystal|transparent|light|bare|demo|clear.?lens|white)\b/.test(name)) {
    score -= 40;
  }
  return Math.max(0, Math.min(100, score));
}

function pickDefaultPreviewPair(frames: FrameEntry[]): { darkId: string; clearId: string } {
  if (frames.length === 0) return { darkId: "", clearId: "" };
  if (frames.length === 1) {
    return { darkId: frames[0].id, clearId: frames[0].id };
  }

  const ranked = [...frames].sort(
    (a, b) => scoreSourceLensDarkness(b) - scoreSourceLensDarkness(a),
  );
  const dark = ranked[0]!;
  const clear =
    ranked.find((f) => f.id !== dark.id) ?? ranked[ranked.length - 1]!;
  const clearest = ranked[ranked.length - 1]!;
  return {
    darkId: dark.id,
    clearId: clearest.id !== dark.id ? clearest.id : clear.id,
  };
}

/**
 * Preview-only layer gates — mirrors Lens Rendering editor layers exactly.
 * Never written to presets / overrides / system defaults.
 */
export type PreviewLookStage = "original" | "glass-only" | "glass-and-tint" | "full";

export interface PreviewRenderMode {
  look: PreviewLookStage;
  glassSheet: boolean;
  tintLayer: boolean;
  reflection: boolean;
  edge: boolean;
  innerFrame: boolean;
  manualDetails: boolean;
}

export const DEFAULT_PREVIEW_RENDER_MODE: PreviewRenderMode = {
  look: "full",
  glassSheet: true,
  tintLayer: true,
  reflection: true,
  edge: true,
  innerFrame: true,
  manualDetails: true,
};

const PREVIEW_LOOK_OPTIONS: Array<{ id: PreviewLookStage; label: string; hint: string }> = [
  { id: "original", label: "Original photo", hint: "Product image only" },
  { id: "glass-only", label: "Glass only", hint: "New glass, no tint" },
  { id: "glass-and-tint", label: "Glass + tint", hint: "Glass coloured, no shine/edge" },
  { id: "full", label: "Full look", hint: "Everything on" },
];

/**
 * Apply temporary preview toggles onto draft material settings.
 * Does not mutate the saved/draft preset object passed in.
 */
export function applyPreviewRenderMode(
  draftSettings: LensClipRenderSettings,
  mode: PreviewRenderMode,
): LensClipRenderSettings {
  const look = mode.look ?? "full";
  return {
    ...draftSettings,
    glassTintEnabled: mode.tintLayer && look !== "original" && look !== "glass-only",
    reflectionEnabled: mode.reflection && look === "full",
    edgeEnabled: mode.edge && look === "full",
    innerFrameEnabled: mode.innerFrame && look !== "original",
    // Sheet is always-on when a URL exists in saved config; preview may temporarily clear it.
    glassSheetUrl: mode.glassSheet && look !== "original" ? draftSettings.glassSheetUrl : null,
    glassBaseSource:
      look === "original"
        ? draftSettings.glassBaseSource
        : mode.glassSheet
          ? draftSettings.glassBaseSource ?? (draftSettings.glassSheetUrl ? "sheet" : "canvas")
          : "canvas",
    glassDebugStage:
      look === "original"
        ? "original"
        : look === "glass-only"
          ? "glass-base"
          : look === "glass-and-tint"
            ? "glass-tint"
            : "full",
    // Keep environment retired; preserve density gradient from draft when present.
    backgroundVisibility: 0,
    environmentTransparency: 0,
  };
}

interface LensRenderPresetLivePreviewProps {
  draftSettings: LensClipRenderSettings;
  systemDefaults: LensClipRenderSettings;
  previewTintHex: string;
  onPreviewTintChange: (hex: string) => void;
}

/**
 * Single preview card with two Front-view panes for material calibration.
 * Independent temporary controls; never persists to presets / overrides / defaults.
 */
export function LensRenderPresetLivePreview({
  draftSettings,
  systemDefaults,
  previewTintHex,
  onPreviewTintChange,
}: LensRenderPresetLivePreviewProps) {
  const { frames } = useCatalogue();
  const previewFrames = useMemo(() => framesWithClipReady(frames), [frames]);
  const defaults = useMemo(() => pickDefaultPreviewPair(previewFrames), [previewFrames]);

  const [frameIdLeft, setFrameIdLeft] = useState("");
  const [frameIdRight, setFrameIdRight] = useState("");
  const [modeLeft, setModeLeft] = useState<PreviewRenderMode>(DEFAULT_PREVIEW_RENDER_MODE);
  const [modeRight, setModeRight] = useState<PreviewRenderMode>(DEFAULT_PREVIEW_RENDER_MODE);

  useEffect(() => {
    if (!previewFrames.length) return;
    const ids = new Set(previewFrames.map((f) => f.id));
    setFrameIdLeft((prev) => (prev && ids.has(prev) ? prev : defaults.darkId));
    setFrameIdRight((prev) => (prev && ids.has(prev) ? prev : defaults.clearId));
  }, [previewFrames, defaults.darkId, defaults.clearId]);

  const frameLeft = previewFrames.find((f) => f.id === frameIdLeft) ?? previewFrames[0];
  const frameRight =
    previewFrames.find((f) => f.id === frameIdRight) ??
    previewFrames.find((f) => f.id !== frameLeft?.id) ??
    previewFrames[0];

  const tint = useMemo(
    () => ({
      id: "preview-tint",
      name: "Preview",
      top: isValidHexColor(previewTintHex) ? previewTintHex : "#8F1830",
      bottom: isValidHexColor(previewTintHex) ? previewTintHex : "#8F1830",
      category: "classic" as const,
      opacity: 1,
    }),
    [previewTintHex],
  );

  const buildConfig = (frame: FrameEntry | undefined, mode: PreviewRenderMode) => {
    if (!frame) return null;
    return buildCustomiserCompositorConfig({
      frameSku: {
        id: frame.id,
        name: frame.name,
        price: frame.price,
        renderViews: frame.renderViews,
        lensRenderPresetId: frame.lensRenderPresetId,
        useLensRenderPreset: frame.useLensRenderPreset,
      },
      tint,
      options: {},
      lensRenderSystemDefaults: systemDefaults,
      renderSettingsOverride: applyPreviewRenderMode(draftSettings, mode),
      previewGlassOccludersEnabled: mode.manualDetails,
    });
  };

  const configLeft = useMemo(
    () => buildConfig(frameLeft, modeLeft),
    [frameLeft, tint, draftSettings, systemDefaults, modeLeft],
  );
  const configRight = useMemo(
    () => buildConfig(frameRight, modeRight),
    [frameRight, tint, draftSettings, systemDefaults, modeRight],
  );

  if (!previewFrames.length) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
        Add an active frame with a ready front lens clip to preview materials.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <TintColorControl
        id="lens-render-preview-colour"
        label="Current tint"
        hint="HEX only (for example #8F1830). Applied to both previews. Catalogue tint colours are unchanged."
        value={previewTintHex}
        onChange={(hex) => onPreviewTintChange(hex.toUpperCase())}
      />

      <div className="rounded-lg border border-border bg-background/40 p-3">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/80">
              Live preview
            </p>
            <p className="text-[10px] text-muted-foreground">
              Compare looks on real frames. These toggles are temporary and never change the saved
              preset.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PreviewPane
            label="Left preview"
            frames={previewFrames}
            selectedId={frameLeft?.id ?? ""}
            onSelect={setFrameIdLeft}
            mode={modeLeft}
            onModeChange={setModeLeft}
            config={configLeft}
          />
          <PreviewPane
            label="Right preview"
            frames={previewFrames}
            selectedId={frameRight?.id ?? ""}
            onSelect={setFrameIdRight}
            mode={modeRight}
            onModeChange={setModeRight}
            config={configRight}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-foreground">
      <input
        type="checkbox"
        className="accent-foreground"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function PreviewPane({
  label,
  frames,
  selectedId,
  onSelect,
  mode,
  onModeChange,
  config,
}: {
  label: string;
  frames: FrameEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  mode: PreviewRenderMode;
  onModeChange: (next: PreviewRenderMode) => void;
  config: ReturnType<typeof buildCustomiserCompositorConfig>;
}) {
  const frame = frames.find((f) => f.id === selectedId);
  const patchMode = (partial: Partial<PreviewRenderMode>) => {
    onModeChange({ ...mode, ...partial });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      {!config || !frame ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Select a frame with a ready front clip.
        </div>
      ) : (
        <SunglassesCompositor
          key={`${selectedId}-front-${mode.look}-${mode.glassSheet}-${mode.tintLayer}-${mode.reflection}-${mode.edge}-${mode.innerFrame}-${mode.manualDetails}`}
          config={config}
          view="front"
          label="Front"
          fillHeight
          compactLabel
          className="min-h-[200px] overflow-hidden rounded-md bg-transparent"
        />
      )}

      <label className="space-y-1 text-xs">
        <span className="font-medium text-foreground">Frame</span>
        <select
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Compare look
        </p>
        <div className="flex flex-wrap gap-1">
          {PREVIEW_LOOK_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              onClick={() => patchMode({ look: option.id })}
              className={
                mode.look === option.id
                  ? "rounded border border-foreground/40 bg-foreground px-2 py-1 text-[10px] font-medium text-background"
                  : "rounded border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/40"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Layers
        </p>
        <PreviewToggle
          label="Photo glass"
          checked={mode.glassSheet}
          onChange={(glassSheet) => patchMode({ glassSheet })}
        />
        <PreviewToggle
          label="Tint layer"
          checked={mode.tintLayer}
          onChange={(tintLayer) => patchMode({ tintLayer })}
        />
        <PreviewToggle
          label="Reflection"
          checked={mode.reflection}
          onChange={(reflection) => patchMode({ reflection })}
        />
        <PreviewToggle
          label="Edge"
          checked={mode.edge}
          onChange={(edge) => patchMode({ edge })}
        />
        <PreviewToggle
          label="Inner Frame"
          checked={mode.innerFrame}
          onChange={(innerFrame) => patchMode({ innerFrame })}
        />
        <PreviewToggle
          label="Manual Details"
          checked={mode.manualDetails}
          onChange={(manualDetails) => patchMode({ manualDetails })}
        />
      </div>
    </div>
  );
}
