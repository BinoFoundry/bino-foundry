import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  mergeStrandRenderProfile,
  effectiveStrandContactWidth,
  parseStrandRenderProfile,
  STRAND_CONTACT_SPACING_MAX,
  STRAND_CONTACT_SPACING_STEP,
  STRAND_LAYOUT_SCALE_MAX,
  STRAND_LAYOUT_SCALE_MIN,
  STRAND_LAYOUT_SCALE_STEP,
  STRAND_VERTICAL_OFFSET_MAX,
  STRAND_VERTICAL_OFFSET_MIN,
  STRAND_VERTICAL_OFFSET_STEP,
  STRAND_VISUAL_SCALE_MAX,
  STRAND_VISUAL_SCALE_MIN,
  STRAND_VISUAL_SCALE_STEP,
  STRAND_VISUAL_SIZE_SCALING_MAX,
  STRAND_VISUAL_SIZE_SCALING_MIN,
  STRAND_VISUAL_SIZE_SCALING_STEP,
  STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM,
  strandRenderSourceLabel,
  type StrandAnchorPreset,
  type StrandOrientationMode,
  type StrandRenderConfigSource,
  type StrandRenderProfile,
  type StrandRenderProfileKey,
  type StrandRotationMode,
  anchorCoordsForPreset,
} from "@bino-foundry/shared/types";

import { AdminDeferredNumberInput, AdminNumberWithSlider } from "./AdminDeferredNumberInput";
import { adminFieldClass } from "./admin-styles";
import { StrandRenderLivePreview } from "./StrandRenderLivePreview";

export type StrandRenderConfigPanelMode = "system" | "beadType" | "subBeadType" | "bead";

type CalibrationFieldKey =
  | "layoutScale"
  | "strandOccupancy"
  | "visualScale"
  | "visualSizeScaling"
  | "verticalOffset";

export interface StrandRenderConfigPanelProps {
  mode: StrandRenderConfigPanelMode;
  /** Effective values shown in the form. */
  value: StrandRenderProfile;
  /** Per-field provenance (bead mode only). */
  provenance?: Partial<Record<StrandRenderProfileKey, StrandRenderConfigSource>>;
  /** Bead mode: inherit all values from bead type. */
  inheritTypeDefaults?: boolean;
  onInheritTypeDefaultsChange?: (inherit: boolean) => void;
  onChange: (patch: Partial<StrandRenderProfile>) => void;
  onResetToType?: () => void;
  onResetToSystem?: () => void;
  disabled?: boolean;
  showAdvanced?: boolean;
  /** Sample asset for the live preview (optional placeholder when missing). */
  previewImageUrl?: string | null;
  /** Library bead used for Builder-matching slot sizing in the live preview. */
  previewSampleBead?: import("@/types/beads").BeadLibraryEntry | null;
  /**
   * Enabled size mm values from the current bead editor form (unsaved).
   * Drives Preview Size options without persisting anything.
   */
  previewSizeMms?: number[];
  /** Show lightweight strand preview (type / sub-type / bead editors). */
  showLivePreview?: boolean;
}

function SourceBadge({ source }: { source?: StrandRenderConfigSource }) {
  if (!source) return null;
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {strandRenderSourceLabel(source)}
    </span>
  );
}

function fieldClass(readOnly: boolean): string {
  return [
    adminFieldClass(),
    readOnly ? "cursor-not-allowed opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function StrandRenderConfigPanel({
  mode,
  value,
  provenance,
  inheritTypeDefaults = true,
  onInheritTypeDefaultsChange,
  onChange,
  onResetToType,
  onResetToSystem,
  disabled = false,
  showAdvanced = false,
  previewImageUrl = null,
  previewSampleBead = null,
  previewSizeMms,
  showLivePreview,
}: StrandRenderConfigPanelProps) {
  const inheritedLock =
    (mode === "bead" || mode === "subBeadType") && inheritTypeDefaults;
  const readOnly = disabled || inheritedLock;
  const livePreview =
    showLivePreview ??
    (mode === "beadType" || mode === "subBeadType" || mode === "bead" || mode === "system");
  const title =
    mode === "system"
      ? "System rendering defaults"
      : mode === "beadType"
        ? "Bead type rendering defaults"
        : mode === "subBeadType"
          ? "Sub-type rendering defaults"
          : "Strand appearance";

  /**
   * Local editable draft for EVERY control.
   * Parent/resolved props hydrate into this, but commits update it immediately so selects
   * and numbers never appear "stuck" while waiting on inheritance/resolve round-trips.
   */
  const [draft, setDraft] = useState<StrandRenderProfile>(() => ({ ...value }));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CalibrationFieldKey, string>>>({});
  const editingFieldsRef = useRef<Set<CalibrationFieldKey>>(new Set());
  const pendingCommitsRef = useRef<Partial<Record<keyof StrandRenderProfile, unknown>>>({});

  // Hydrate from parent for keys that are not mid-edit / awaiting parent ack.
  useEffect(() => {
    setDraft((prev) => {
      let changed = false;
      const next: StrandRenderProfile = { ...prev };
      (Object.keys(value) as (keyof StrandRenderProfile)[]).forEach((key) => {
        if (editingFieldsRef.current.has(key as CalibrationFieldKey)) return;
        const pending = pendingCommitsRef.current[key];
        if (pending !== undefined) {
          if (Object.is(value[key], pending)) {
            delete pendingCommitsRef.current[key];
          } else {
            if (!Object.is(next[key], pending)) {
              (next as Record<string, unknown>)[key] = pending;
              changed = true;
            }
            return;
          }
        }
        if (!Object.is(next[key], value[key])) {
          (next as Record<string, unknown>)[key] = value[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [value]);

  const setFieldError = (key: CalibrationFieldKey, message: string | null) => {
    setFieldErrors((prev) => {
      if (!message) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === message) return prev;
      return { ...prev, [key]: message };
    });
  };

  const patchDraft = (patch: Partial<StrandRenderProfile>) => {
    if (readOnly) return;
    for (const key of Object.keys(patch) as (keyof StrandRenderProfile)[]) {
      pendingCommitsRef.current[key] = patch[key];
    }
    setDraft((prev) => ({ ...prev, ...patch }));
    onChange(patch);
  };

  const commitCalibration = (key: CalibrationFieldKey, next: number) => {
    patchDraft({ [key]: next });
  };

  const setFieldEditing = (key: CalibrationFieldKey, editing: boolean) => {
    if (editing) editingFieldsRef.current.add(key);
    else editingFieldsRef.current.delete(key);
  };

  const discardLocalEdits = () => {
    pendingCommitsRef.current = {};
    editingFieldsRef.current.clear();
  };

  const previewProfile = useMemo(() => draft, [draft]);

  return (
    <section className="space-y-2 rounded-xl border border-border bg-muted/15 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {mode === "system"
              ? "General defaults. Type, sub-type, and bead settings override these."
              : mode === "beadType"
                ? "Overrides General. Inherited by sub-types and beads unless they set their own values."
                : mode === "subBeadType"
                  ? "Overrides General and Bead Type when not using parent calibration. Beads inherit unless overridden."
                  : "Overrides General → Type → Sub-type for this asset only."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "bead" && onResetToType ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                discardLocalEdits();
                onResetToType();
              }}
            >
              Reset to sub-type
            </button>
          ) : null}
          {(mode === "subBeadType" || mode === "beadType") && onResetToType ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                discardLocalEdits();
                onResetToType();
              }}
            >
              Reset to bead type
            </button>
          ) : null}
          {mode !== "system" && onResetToSystem ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                discardLocalEdits();
                onResetToSystem();
              }}
            >
              Reset to system defaults
            </button>
          ) : null}
        </div>
      </div>

      {(mode === "bead" || mode === "subBeadType") && onInheritTypeDefaultsChange ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-0.5 py-2 text-sm leading-snug">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 rounded border border-border accent-foreground"
            checked={inheritTypeDefaults}
            onChange={(e) => {
              discardLocalEdits();
              onInheritTypeDefaultsChange(e.target.checked);
            }}
          />
          <span className="select-none">Use Parent Calibration</span>
        </label>
      ) : null}

      {(mode === "bead" || mode === "subBeadType") && onInheritTypeDefaultsChange ? (
        <p className="mt-0 text-[10px] leading-snug text-muted-foreground">
          When enabled, this level reuses its parent calibration values. Fields become read-only
          and may show <span className="font-medium">AUTO</span> badges (inherited). Turn it off to
          edit this level’s own settings (<span className="font-medium">Custom Override</span>).
        </p>
      ) : null}

      {inheritedLock ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Controls are locked while <span className="font-medium">Use Parent Calibration</span> is
          on. Uncheck it to edit Orientation, Anchor Point, and other rendering options for this
          level.
        </p>
      ) : null}

      {/* Balance spacing on its own row; main fields in a compact 3-col grid for laptop. */}
      <div
        className={inheritedLock ? "pointer-events-none space-y-2 opacity-70" : "space-y-2"}
        aria-disabled={inheritedLock || undefined}
      >
        <Field label="Balance spacing" source={provenance?.balanceSpacing} readOnly={readOnly}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={draft.balanceSpacing}
              onChange={(e) => patchDraft({ balanceSpacing: e.target.checked })}
            />
            Equalise empty gaps (Top / Right / Bottom / Left)
          </label>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            When on, leftover empty space on the bracelet is shared evenly so gaps look balanced.
            Does not change bead size.
          </p>
        </Field>

        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {mode === "system" ? (
            <Field
              label="Visual size scaling"
              source={provenance?.visualSizeScaling}
              readOnly={readOnly}
            >
              <AdminDeferredNumberInput
                value={draft.visualSizeScaling}
                onCommit={(visualSizeScaling) =>
                  commitCalibration("visualSizeScaling", visualSizeScaling)
                }
                onEditingChange={(editing) => setFieldEditing("visualSizeScaling", editing)}
                min={STRAND_VISUAL_SIZE_SCALING_MIN}
                max={STRAND_VISUAL_SIZE_SCALING_MAX}
                step={STRAND_VISUAL_SIZE_SCALING_STEP}
                decimals={2}
                disabled={readOnly}
                aria-label="Visual size scaling"
                clampOnCommit={false}
                onRangeError={(message) => setFieldError("visualSizeScaling", message)}
                onClearError={() => setFieldError("visualSizeScaling", null)}
              />
              <InputExamples examples={["0.50", "0.70", "1.00", "1.25"]} />
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                Controls how strongly size jumps between catalogue mm look (6 → 8 → 10&nbsp;mm).{" "}
                <span className="font-medium">1.00</span> = linear / natural. Lower = subtler
                differences. {STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM}&nbsp;mm stays fixed. Turn on
                Compare sizes in the preview to see the effect.
              </p>
              <FieldError message={fieldErrors.visualSizeScaling} />
            </Field>
          ) : (
            <>
              <Field label="Render size" source={provenance?.visualScale} readOnly={readOnly}>
                <AdminDeferredNumberInput
                  value={draft.visualScale}
                  onCommit={(visualScale) => commitCalibration("visualScale", visualScale)}
                  onEditingChange={(editing) => setFieldEditing("visualScale", editing)}
                  min={STRAND_VISUAL_SCALE_MIN}
                  max={STRAND_VISUAL_SCALE_MAX}
                  step={STRAND_VISUAL_SCALE_STEP}
                  decimals={2}
                  disabled={readOnly}
                  aria-label="Render size"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("visualScale", message)}
                  onClearError={() => setFieldError("visualScale", null)}
                />
                <InputExamples examples={["0.50", "1.00", "1.20", "2.00"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Controls how large the asset looks on the bracelet.{" "}
                  <span className="font-medium">Higher</span> = visually bigger;{" "}
                  <span className="font-medium">lower</span> = visually smaller. Does not change how
                  much strand space it occupies.
                </p>
                <FieldError message={fieldErrors.visualScale} />
              </Field>

              <Field label="Strand occupancy" source={provenance?.contactWidth} readOnly={readOnly}>
                <AdminDeferredNumberInput
                  value={effectiveStrandContactWidth({
                    contactWidth: draft.contactWidth,
                    contactOffset: draft.contactOffset,
                    spacingAdjustment: draft.spacingAdjustment,
                  })}
                  onCommit={(strandOccupancy) => {
                    patchDraft({
                      strandOccupancy,
                      contactWidth: 1,
                      contactOffset: strandOccupancy - 1,
                      spacingAdjustment: 0,
                    });
                  }}
                  onEditingChange={(editing) => setFieldEditing("strandOccupancy", editing)}
                  min={0}
                  max={STRAND_CONTACT_SPACING_MAX}
                  step={STRAND_CONTACT_SPACING_STEP}
                  decimals={2}
                  disabled={readOnly}
                  aria-label="Strand occupancy"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("strandOccupancy", message)}
                  onClearError={() => setFieldError("strandOccupancy", null)}
                />
                <InputExamples examples={["0.50", "1.00", "1.50", "2.00"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Controls how much space this item takes along the bracelet strand.{" "}
                  <span className="font-medium">Higher</span> = more room between neighbours;{" "}
                  <span className="font-medium">lower</span> = packed tighter. Does not change how
                  large the image looks.
                </p>
                <FieldError message={fieldErrors.strandOccupancy} />
              </Field>

              <Field label="Vertical offset" source={provenance?.verticalOffset} readOnly={readOnly}>
                <AdminDeferredNumberInput
                  value={draft.verticalOffset}
                  onCommit={(verticalOffset) => commitCalibration("verticalOffset", verticalOffset)}
                  onEditingChange={(editing) => setFieldEditing("verticalOffset", editing)}
                  min={STRAND_VERTICAL_OFFSET_MIN}
                  max={STRAND_VERTICAL_OFFSET_MAX}
                  step={STRAND_VERTICAL_OFFSET_STEP}
                  decimals={1}
                  disabled={readOnly}
                  aria-label="Vertical offset"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("verticalOffset", message)}
                  onClearError={() => setFieldError("verticalOffset", null)}
                />
                <InputExamples examples={["-5", "0", "5", "10"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Moves the asset toward or away from the cord (% of item height).{" "}
                  <span className="font-medium">Positive</span> = hangs farther out;{" "}
                  <span className="font-medium">negative</span> = pulls closer to the strand.
                </p>
                <FieldError message={fieldErrors.verticalOffset} />
              </Field>

              <Field label="Anchor point" source={provenance?.anchorPreset} readOnly={readOnly}>
                <select
                  disabled={readOnly}
                  className={fieldClass(readOnly)}
                  value={draft.anchorPreset}
                  onChange={(e) => {
                    const anchorPreset = e.target.value as StrandAnchorPreset;
                    // Always sync coords — overrides often already carry stale anchorX/Y from a
                    // previous preset, and the live preview reads draft.anchorY directly.
                    patchDraft({
                      anchorPreset,
                      ...anchorCoordsForPreset(anchorPreset),
                    });
                  }}
                >
                  <option value="center">Center</option>
                  <option value="loop">Loop (top bail)</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Which part of the asset attaches to the strand.{" "}
                  <span className="font-medium">Loop</span> = top bail (charms);{" "}
                  <span className="font-medium">Center</span> = middle of the asset.
                </p>
              </Field>

              <Field label="Orientation" source={provenance?.orientationMode} readOnly={readOnly}>
                <select
                  disabled={readOnly}
                  className={fieldClass(readOnly)}
                  value={draft.orientationMode}
                  onChange={(e) =>
                    patchDraft({ orientationMode: e.target.value as StrandOrientationMode })
                  }
                >
                  <option value="outward">Outward (away from centre)</option>
                  <option value="inward">Inward (toward centre)</option>
                </select>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Which way the asset faces around the bracelet.{" "}
                  <span className="font-medium">Outward</span> = away from the centre;{" "}
                  <span className="font-medium">Inward</span> = toward the centre.
                </p>
              </Field>
            </>
          )}
        </div>
      </div>

      {showAdvanced ? (
        <div
          className={
            inheritedLock
              ? "pointer-events-none grid gap-3 border-t border-border pt-3 opacity-70 sm:grid-cols-2"
              : "grid gap-3 border-t border-border pt-3 sm:grid-cols-2"
          }
        >
          <SectionHeading title="Advanced" />
          <Field label="Layout scale" source={provenance?.layoutScale} readOnly={readOnly}>
            <AdminDeferredNumberInput
              value={draft.layoutScale}
              onCommit={(layoutScale) => commitCalibration("layoutScale", layoutScale)}
              onEditingChange={(editing) => setFieldEditing("layoutScale", editing)}
              min={STRAND_LAYOUT_SCALE_MIN}
              max={STRAND_LAYOUT_SCALE_MAX}
              step={STRAND_LAYOUT_SCALE_STEP}
              decimals={2}
              disabled={readOnly}
              aria-label="Layout scale"
              clampOnCommit={false}
              onRangeError={(message) => setFieldError("layoutScale", message)}
              onClearError={() => setFieldError("layoutScale", null)}
            />
            <InputExamples examples={["1.00"]} />
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              Rarely needed — keep at 1.00 unless support asks you to change it. Affects layout footprint
              and shell together; prefer Render size and Strand occupancy instead.
            </p>
            <FieldError message={fieldErrors.layoutScale} />
          </Field>
          <Field label="Leading overlap" source={provenance?.leadingOverlap} readOnly={readOnly}>
            <AdminDeferredNumberInput
              value={draft.leadingOverlap}
              onCommit={(leadingOverlap) => patchDraft({ leadingOverlap })}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Trailing overlap" source={provenance?.trailingOverlap} readOnly={readOnly}>
            <AdminDeferredNumberInput
              value={draft.trailingOverlap}
              onCommit={(trailingOverlap) => patchDraft({ trailingOverlap })}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Hang offset" source={provenance?.hangOffset} readOnly={readOnly}>
            <AdminNumberWithSlider
              value={draft.hangOffset}
              onCommit={(hangOffset) => patchDraft({ hangOffset })}
              min={-1}
              max={1}
              step={0.01}
              displayScale={100}
              decimals={0}
              disabled={readOnly}
              aria-label="Hang offset percent"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Percent of bead height (−100 … 100). Supports negative values.
            </p>
          </Field>
          <Field label="Rotation (advanced)" source={provenance?.rotationMode} readOnly={readOnly}>
            <select
              disabled={readOnly}
              className={fieldClass(readOnly)}
              value={draft.rotationMode}
              onChange={(e) =>
                patchDraft({ rotationMode: e.target.value as StrandRotationMode })
              }
            >
              <option value="tangent">Rotate with strand (legacy)</option>
              <option value="radial-upright">Radial upright (legacy)</option>
              <option value="fixed-upright">Stay upright</option>
              <option value="none">No rotation</option>
            </select>
          </Field>
          <Field
            label="Collision padding (px)"
            source={provenance?.collisionPadding}
            readOnly={readOnly}
          >
            <AdminDeferredNumberInput
              value={draft.collisionPadding}
              onCommit={(collisionPadding) => patchDraft({ collisionPadding })}
              min={0}
              max={20}
              step={0.5}
              decimals={1}
              disabled={readOnly}
            />
          </Field>
          <Field
            label="String occlusion (0–1)"
            source={provenance?.stringOcclusion}
            readOnly={readOnly}
          >
            <AdminDeferredNumberInput
              value={draft.stringOcclusion}
              onCommit={(stringOcclusion) => patchDraft({ stringOcclusion })}
              min={0}
              max={1}
              step={0.05}
              decimals={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Attachment style" source={provenance?.attachmentStyle} readOnly={readOnly}>
            <select
              disabled={readOnly}
              className={fieldClass(readOnly)}
              value={draft.attachmentStyle}
              onChange={(e) =>
                patchDraft({
                  attachmentStyle: e.target.value as StrandRenderProfile["attachmentStyle"],
                })
              }
            >
              <option value="inline">Inline</option>
              <option value="betweenItems">Between items</option>
            </select>
          </Field>
          <Field label="Layout mode" source={provenance?.layoutMode} readOnly={readOnly}>
            <select
              disabled={readOnly}
              className={fieldClass(readOnly)}
              value={draft.layoutMode}
              onChange={(e) =>
                patchDraft({
                  layoutMode: e.target.value as StrandRenderProfile["layoutMode"],
                })
              }
            >
              <option value="inline">Inline</option>
              <option value="dangling">Dangling</option>
            </select>
          </Field>
        </div>
      ) : null}

      {mode === "bead" && inheritTypeDefaults ? (
        <p className="text-xs text-muted-foreground">
          Using parent calibration ({strandRenderSourceLabel("subBeadType")} /{" "}
          {strandRenderSourceLabel("beadType")}).
        </p>
      ) : null}

      {livePreview ? (
        <StrandRenderLivePreview
          className="border-t border-border pt-3"
          profile={previewProfile}
          imageUrl={previewImageUrl}
          sampleBead={previewSampleBead}
          previewSizeMms={previewSizeMms}
        />
      ) : null}
    </section>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <p className="col-span-full pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
      {title}
    </p>
  );
}

function Field({
  label,
  source,
  children,
}: {
  label: string;
  source?: StrandRenderConfigSource;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      {children}
    </div>
  );
}

function InputExamples({ examples }: { examples: string[] }) {
  return (
    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
      e.g. {examples.join(" · ")}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-[10px] text-destructive" role="alert">
      {message}
    </p>
  );
}

export function strandRenderPartialFromMetadata(meta: unknown): Partial<StrandRenderProfile> | null {
  return parseStrandRenderProfile(meta);
}

export function mergeStrandRenderPartial(
  current: Partial<StrandRenderProfile> | null,
  patch: Partial<StrandRenderProfile>,
): StrandRenderProfile {
  return mergeStrandRenderProfile(current, patch);
}
