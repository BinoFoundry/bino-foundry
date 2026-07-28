import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GlassSheetCropRect, LensClipRenderSettings } from "@bino-foundry/shared/types";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_LENS_CLIP_RENDER } from "@/render/lens-clip/clip-settings";
import { validateUploadFile } from "@/features/admin/lib/upload-pipeline";
import {
  discardPendingGlassSheet,
  registerPendingGlassSheet,
} from "@/features/admin/lib/glass-sheet-lifecycle";
import { GlassSheetCropModal } from "./GlassSheetCropModal";

interface LensRenderingSettingsPanelProps {
  value: LensClipRenderSettings | null | undefined;
  onChange: (next: LensClipRenderSettings) => void;
  className?: string;
  disabled?: boolean;
}

function SliderRow({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (n) => `${Math.round(n)}%`,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (n: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  );
}

function ToolGroup({
  label,
  valueLabel,
  children,
}: {
  label: string;
  valueLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{valueLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function ToolButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-foreground/40 bg-foreground text-background"
          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40",
        disabled && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function LayerCard({
  title,
  description,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-background/60 p-3">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        </span>
      </label>
      {enabled ? <div className="space-y-3 pl-5">{children}</div> : null}
    </div>
  );
}

const TINT_BLEND_LABELS: Record<
  NonNullable<LensClipRenderSettings["glassTintBlend"]>,
  string
> = {
  kaca: "Glass",
  color: "Color",
  "source-over": "Normal",
  multiply: "Multiply",
};

const INNER_FRAME_BLEND_LABELS: Record<
  NonNullable<LensClipRenderSettings["innerFrameBlendMode"]>,
  string
> = {
  normal: "Normal",
  multiply: "Multiply",
  overlay: "Overlay",
  screen: "Screen",
};

/**
 * Glass sheet foundation + optical layers (tint / reflection / edge).
 * A sheet is always used when a URL exists — no enable toggle.
 * Draft uploads stay local until the parent Save finalizes storage.
 */
export function LensRenderingSettingsPanel({
  value,
  onChange,
  className,
  disabled,
}: LensRenderingSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const draftBlobRef = useRef<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<{
    url: string;
    width: number;
    height: number;
    initialCrop: GlassSheetCropRect | null;
    isNewUpload: boolean;
    file: File | null;
  } | null>(null);

  const sheetUrl = value?.glassSheetUrl ?? DEFAULT_LENS_CLIP_RENDER.glassSheetUrl;
  const sheetFit = value?.glassSheetFit ?? DEFAULT_LENS_CLIP_RENDER.glassSheetFit;
  const sheetScale = value?.glassSheetScale ?? DEFAULT_LENS_CLIP_RENDER.glassSheetScale;
  const sheetOffsetX = value?.glassSheetOffsetX ?? DEFAULT_LENS_CLIP_RENDER.glassSheetOffsetX;
  const sheetOffsetY = value?.glassSheetOffsetY ?? DEFAULT_LENS_CLIP_RENDER.glassSheetOffsetY;
  const sheetTex =
    value?.glassSheetTextureStrength ?? DEFAULT_LENS_CLIP_RENDER.glassSheetTextureStrength;
  const sheetShine = value?.glassSheetShine ?? DEFAULT_LENS_CLIP_RENDER.glassSheetShine;
  const crop = value?.glassSheetCrop ?? null;
  const naturalWidth = value?.glassSheetNaturalWidth ?? 1024;
  const naturalHeight = value?.glassSheetNaturalHeight ?? 576;

  const tintEnabled = value?.glassTintEnabled ?? DEFAULT_LENS_CLIP_RENDER.glassTintEnabled;
  const tintOpacity = Math.round(
    (value?.tintLayerOpacity ?? DEFAULT_LENS_CLIP_RENDER.tintLayerOpacity) * 100,
  );
  const tintBlend = value?.glassTintBlend ?? DEFAULT_LENS_CLIP_RENDER.glassTintBlend;
  const tintDepth = value?.glassDepth ?? DEFAULT_LENS_CLIP_RENDER.glassDepth;
  const tintShine = value?.glassTintShine ?? DEFAULT_LENS_CLIP_RENDER.glassTintShine;

  const reflectionEnabled =
    value?.reflectionEnabled ?? DEFAULT_LENS_CLIP_RENDER.reflectionEnabled;
  const reflectionOpacity = Math.round(
    (value?.reflectionOpacity ?? DEFAULT_LENS_CLIP_RENDER.reflectionOpacity) * 100,
  );

  const edgeEnabled = value?.edgeEnabled ?? DEFAULT_LENS_CLIP_RENDER.edgeEnabled;
  const edgeDensity = Math.round(
    (value?.edgeDensity ?? DEFAULT_LENS_CLIP_RENDER.edgeDensity) * 100,
  );
  const edgeOpacity = Math.round(
    (value?.edgeOpacity ?? DEFAULT_LENS_CLIP_RENDER.edgeOpacity) * 100,
  );

  const innerFrameEnabled =
    value?.innerFrameEnabled ?? DEFAULT_LENS_CLIP_RENDER.innerFrameEnabled;
  const innerFrameThickness =
    value?.innerFrameThickness ?? DEFAULT_LENS_CLIP_RENDER.innerFrameThickness;
  const innerFrameOpacity =
    value?.innerFrameOpacity ?? DEFAULT_LENS_CLIP_RENDER.innerFrameOpacity;
  const innerFrameFeather =
    value?.innerFrameFeather ?? DEFAULT_LENS_CLIP_RENDER.innerFrameFeather;
  const innerFrameBlendMode =
    value?.innerFrameBlendMode ?? DEFAULT_LENS_CLIP_RENDER.innerFrameBlendMode;

  const patch = (partial: Partial<LensClipRenderSettings>) => {
    onChange({
      ...value,
      automaticMaterialBehavior: false,
      ...partial,
    });
  };

  const revokeDraftBlob = () => {
    if (draftBlobRef.current) {
      discardPendingGlassSheet(draftBlobRef.current);
      draftBlobRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (draftBlobRef.current) {
        discardPendingGlassSheet(draftBlobRef.current);
        draftBlobRef.current = null;
      }
    };
  }, []);

  const clearSheet = () => {
    revokeDraftBlob();
    patch({
      glassSheetUrl: null,
      glassSheetNaturalWidth: null,
      glassSheetNaturalHeight: null,
      glassSheetCrop: null,
    });
  };

  const openFilePicker = () => fileRef.current?.click();

  const beginUpload = async (file: File | undefined) => {
    if (!file || disabled) return;
    const validationError = validateUploadFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setFileError(null);

    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read image dimensions"));
      };
      img.src = objectUrl;
    }).catch((err: unknown) => {
      setFileError(err instanceof Error ? err.message : "Could not read image");
      return null;
    });
    if (!dims) return;

    const blobUrl = URL.createObjectURL(file);
    setCropSession({
      url: blobUrl,
      width: dims.width,
      height: dims.height,
      initialCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      isNewUpload: true,
      file,
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const openRecrop = () => {
    if (!sheetUrl) return;
    setCropSession({
      url: sheetUrl,
      width: naturalWidth,
      height: naturalHeight,
      initialCrop: crop,
      isNewUpload: false,
      file: null,
    });
  };

  const confirmCrop = (nextCrop: GlassSheetCropRect) => {
    if (!cropSession) return;

    if (cropSession.isNewUpload && cropSession.file) {
      revokeDraftBlob();
      const blobUrl = cropSession.url;
      registerPendingGlassSheet(blobUrl, cropSession.file);
      draftBlobRef.current = blobUrl;
      patch({
        glassSheetUrl: blobUrl,
        glassSheetNaturalWidth: cropSession.width,
        glassSheetNaturalHeight: cropSession.height,
        glassSheetCrop: nextCrop,
      });
    } else {
      if (cropSession.isNewUpload) {
        try {
          URL.revokeObjectURL(cropSession.url);
        } catch {
          // ignore
        }
      }
      patch({ glassSheetCrop: nextCrop });
    }

    setCropSession(null);
  };

  const cancelCrop = () => {
    if (cropSession?.isNewUpload) {
      try {
        URL.revokeObjectURL(cropSession.url);
      } catch {
        // ignore
      }
    }
    setCropSession(null);
  };

  return (
    <div className={cn("space-y-3 rounded-md border border-border/80 bg-muted/20 p-3", className)}>
      <div>
        <p className="type-label text-muted-foreground">Lens optics</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Glass sheet provides texture. Tint colours it. Reflection and edge finish the material.
          Upload is temporary until you click Save on this preset.
        </p>
      </div>

      <div className="space-y-3 rounded-md border border-border/70 bg-background/60 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Glass sheet</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Always active when a sheet is uploaded. Manage upload, crop, fit, and material texture.
          </p>
        </div>

        <div className="space-y-2">
          {sheetUrl ? (
            <div className="relative overflow-hidden rounded border border-border/70 bg-[#1a1a1e]">
              <img
                src={sheetUrl}
                alt="Glass sheet"
                className="mx-auto max-h-28 w-full object-contain"
              />
              {crop ? (
                <div
                  className="pointer-events-none absolute border border-emerald-400/80"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No sheet yet — upload one to replace the original lens.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              disabled={disabled}
              onChange={(e) => void beginUpload(e.target.files?.[0])}
            />
            <ToolButton active={false} disabled={disabled} onClick={openFilePicker}>
              {sheetUrl ? "Replace sheet" : "Upload sheet"}
            </ToolButton>
            {sheetUrl ? (
              <ToolButton active={false} disabled={disabled} onClick={openRecrop}>
                Edit crop
              </ToolButton>
            ) : null}
            {sheetUrl ? (
              <ToolButton active={false} disabled={disabled} onClick={clearSheet}>
                Delete sheet
              </ToolButton>
            ) : null}
          </div>
          {fileError ? <p className="text-[11px] text-destructive">{fileError}</p> : null}
          {sheetUrl?.startsWith("blob:") ? (
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Draft sheet — not saved to storage until you click Save.
            </p>
          ) : null}
        </div>

        <ToolGroup label="Fit mode" valueLabel={sheetFit === "contain" ? "Contain" : "Cover"}>
          <ToolButton
            active={sheetFit === "cover"}
            disabled={disabled || !sheetUrl}
            onClick={() => patch({ glassSheetFit: "cover" })}
          >
            Cover
          </ToolButton>
          <ToolButton
            active={sheetFit === "contain"}
            disabled={disabled || !sheetUrl}
            onClick={() => patch({ glassSheetFit: "contain" })}
          >
            Contain
          </ToolButton>
        </ToolGroup>

        <SliderRow
          label="Scale"
          value={Math.round(sheetScale * 100)}
          min={25}
          max={300}
          disabled={disabled || !sheetUrl}
          onChange={(pct) => patch({ glassSheetScale: pct / 100 })}
        />
        <SliderRow
          label="Offset X"
          value={sheetOffsetX}
          min={-100}
          max={100}
          disabled={disabled || !sheetUrl}
          formatValue={(n) => `${Math.round(n)}`}
          onChange={(glassSheetOffsetX) => patch({ glassSheetOffsetX })}
        />
        <SliderRow
          label="Offset Y"
          value={sheetOffsetY}
          min={-100}
          max={100}
          disabled={disabled || !sheetUrl}
          formatValue={(n) => `${Math.round(n)}`}
          onChange={(glassSheetOffsetY) => patch({ glassSheetOffsetY })}
        />
        <SliderRow
          label="Texture strength"
          value={sheetTex}
          disabled={disabled || !sheetUrl}
          onChange={(glassSheetTextureStrength) => patch({ glassSheetTextureStrength })}
        />
        <SliderRow
          label="Sheet shine"
          value={sheetShine}
          disabled={disabled || !sheetUrl}
          onChange={(glassSheetShine) => patch({ glassSheetShine })}
        />
      </div>

      <LayerCard
        title="Tint layer"
        description="Colours the glass sheet. Customer tint HEX stays outside this panel."
        enabled={tintEnabled}
        disabled={disabled}
        onToggle={(glassTintEnabled) => patch({ glassTintEnabled })}
      >
        <SliderRow
          label="Opacity"
          value={tintOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ tintLayerOpacity: pct / 100, tintOpacity: pct / 100 })}
        />
        <ToolGroup label="Blend mode" valueLabel={TINT_BLEND_LABELS[tintBlend]}>
          {(
            [
              ["kaca", "Glass"],
              ["color", "Color"],
              ["source-over", "Normal"],
              ["multiply", "Multiply"],
            ] as const
          ).map(([mode, label]) => (
            <ToolButton
              key={mode}
              active={tintBlend === mode}
              disabled={disabled}
              onClick={() => patch({ glassTintBlend: mode })}
            >
              {label}
            </ToolButton>
          ))}
        </ToolGroup>
        <SliderRow
          label="Glass depth"
          value={tintDepth}
          disabled={disabled}
          onChange={(glassDepth) => patch({ glassDepth })}
        />
        <SliderRow
          label="Surface shine"
          value={tintShine}
          disabled={disabled}
          onChange={(glassTintShine) => patch({ glassTintShine })}
        />
      </LayerCard>

      <LayerCard
        title="Reflection"
        description="Specular catch-light on the glass surface."
        enabled={reflectionEnabled}
        disabled={disabled}
        onToggle={(enabled) =>
          patch({
            reflectionEnabled: enabled,
            ...(enabled && (value?.reflectionStrength == null || value.reflectionStrength < 0.05)
              ? { reflectionStrength: DEFAULT_LENS_CLIP_RENDER.reflectionStrength }
              : {}),
          })
        }
      >
        <SliderRow
          label="Reflection opacity"
          value={reflectionOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ reflectionOpacity: pct / 100 })}
        />
      </LayerCard>

      <LayerCard
        title="Edge"
        description="Rim thickness and darkness toward the lens edge."
        enabled={edgeEnabled}
        disabled={disabled}
        onToggle={(next) => patch({ edgeEnabled: next })}
      >
        <SliderRow
          label="Edge density"
          value={edgeDensity}
          disabled={disabled}
          onChange={(pct) => patch({ edgeDensity: pct / 100 })}
        />
        <SliderRow
          label="Edge opacity"
          value={edgeOpacity}
          disabled={disabled}
          onChange={(pct) => patch({ edgeOpacity: pct / 100, edgeDarkness: pct / 100 })}
        />
      </LayerCard>

      <LayerCard
        title="Inner Frame"
        description="Automatic inset lip from each lens opening — no manual polygon."
        enabled={innerFrameEnabled}
        disabled={disabled}
        onToggle={(next) => patch({ innerFrameEnabled: next })}
      >
        <SliderRow
          label="Thickness"
          value={innerFrameThickness}
          min={0}
          max={8}
          step={0.5}
          disabled={disabled}
          formatValue={(n) => `${n} px`}
          onChange={(innerFrameThickness) => patch({ innerFrameThickness })}
        />
        <SliderRow
          label="Opacity"
          value={innerFrameOpacity}
          disabled={disabled}
          onChange={(innerFrameOpacity) => patch({ innerFrameOpacity })}
        />
        <SliderRow
          label="Feather"
          value={innerFrameFeather}
          disabled={disabled}
          onChange={(innerFrameFeather) => patch({ innerFrameFeather })}
        />
        <ToolGroup
          label="Blend mode"
          valueLabel={INNER_FRAME_BLEND_LABELS[innerFrameBlendMode]}
        >
          {(
            Object.keys(INNER_FRAME_BLEND_LABELS) as Array<
              keyof typeof INNER_FRAME_BLEND_LABELS
            >
          ).map((mode) => (
            <ToolButton
              key={mode}
              active={innerFrameBlendMode === mode}
              disabled={disabled}
              onClick={() => patch({ innerFrameBlendMode: mode })}
            >
              {INNER_FRAME_BLEND_LABELS[mode]}
            </ToolButton>
          ))}
        </ToolGroup>
      </LayerCard>

      {cropSession ? (
        <GlassSheetCropModal
          open
          imageUrl={cropSession.url}
          naturalWidth={cropSession.width}
          naturalHeight={cropSession.height}
          initialCrop={cropSession.initialCrop}
          onConfirm={confirmCrop}
          onCancel={cancelCrop}
        />
      ) : null}
    </div>
  );
}
