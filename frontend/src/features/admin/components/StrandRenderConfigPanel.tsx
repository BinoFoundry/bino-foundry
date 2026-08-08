import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  STRAND_CONTACT_SPACING_MAX,
  STRAND_CONTACT_SPACING_MIN,
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
  strandRenderSourceLabel,
  type StrandAnchorPreset,
  type StrandOrientationMode,
  type StrandRenderConfigSource,
  type StrandRenderProfile,
  type StrandRenderProfileKey,
  type StrandRotationMode,
} from "@bino-foundry/shared/types";

import { AdminDeferredNumberInput, AdminNumberWithSlider } from "./AdminDeferredNumberInput";
import { adminFieldClass } from "./admin-styles";
import { StrandRenderLivePreview } from "./StrandRenderLivePreview";

export type StrandRenderConfigPanelMode = "system" | "beadType" | "subBeadType" | "bead";

type CalibrationFieldKey =
  | "layoutScale"
  | "contactWidth"
  | "contactOffset"
  | "visualScale"
  | "verticalOffset";

const CALIBRATION_KEYS: readonly CalibrationFieldKey[] = [
  "layoutScale",
  "contactWidth",
  "contactOffset",
  "visualScale",
  "verticalOffset",
] as const;

type CalibrationValues = Pick<StrandRenderProfile, CalibrationFieldKey>;

function calibrationFromProfile(profile: StrandRenderProfile): CalibrationValues {
  return {
    layoutScale: profile.layoutScale,
    contactWidth: profile.contactWidth,
    contactOffset: profile.contactOffset,
    visualScale: profile.visualScale,
    verticalOffset: profile.verticalOffset,
  };
}

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
  showLivePreview,
}: StrandRenderConfigPanelProps) {
  const readOnly = disabled || ((mode === "bead" || mode === "subBeadType") && inheritTypeDefaults);
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CalibrationFieldKey, string>>>({});
  /** Editable calibration snapshot — updated on commit; not overwritten while a field is focused. */
  const [editValues, setEditValues] = useState<CalibrationValues>(() => calibrationFromProfile(value));
  const editingFieldsRef = useRef<Set<CalibrationFieldKey>>(new Set());
  /** Commits waiting for parent props to catch up — prevents stale hydrate from reverting blur. */
  const pendingCommitsRef = useRef<Partial<Record<CalibrationFieldKey, number>>>({});
  const propsCalibration = useMemo(
    () => calibrationFromProfile(value),
    [
      value.layoutScale,
      value.contactWidth,
      value.contactOffset,
      value.visualScale,
      value.verticalOffset,
    ],
  );

  // Hydrate from parent when not editing and not waiting on a local commit.
  useEffect(() => {
    setEditValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of CALIBRATION_KEYS) {
        if (editingFieldsRef.current.has(key)) continue;
        const propVal = propsCalibration[key];
        const pending = pendingCommitsRef.current[key];
        if (pending !== undefined) {
          if (propVal === pending) {
            delete pendingCommitsRef.current[key];
          } else if (next[key] !== pending) {
            // Parent has not applied our commit yet — keep the local value.
            next[key] = pending;
            changed = true;
          }
          continue;
        }
        if (next[key] !== propVal) {
          next[key] = propVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [propsCalibration]);

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

  const commitCalibration = (key: CalibrationFieldKey, next: number) => {
    pendingCommitsRef.current[key] = next;
    setEditValues((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    onChange({ [key]: next });
  };

  const setFieldEditing = (key: CalibrationFieldKey, editing: boolean) => {
    if (editing) editingFieldsRef.current.add(key);
    else editingFieldsRef.current.delete(key);
  };

  const discardLocalCalibrationEdits = () => {
    pendingCommitsRef.current = {};
    editingFieldsRef.current.clear();
  };

  const previewProfile = useMemo(() => ({ ...value, ...editValues }), [value, editValues]);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
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
                discardLocalCalibrationEdits();
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
                discardLocalCalibrationEdits();
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
                discardLocalCalibrationEdits();
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
              discardLocalCalibrationEdits();
              onInheritTypeDefaultsChange(e.target.checked);
            }}
          />
          <span className="select-none">Use Parent Calibration</span>
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Layout scale" source={provenance?.layoutScale} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={editValues.layoutScale}
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
          <InputExamples examples={["0.50", "1.00", "2.00", "3.75", "5.00"]} />
          <FieldError message={fieldErrors.layoutScale} />
        </Field>
        <Field label="Balance spacing" source={provenance?.balanceSpacing} readOnly={readOnly}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={value.balanceSpacing}
              onChange={(e) => onChange({ balanceSpacing: e.target.checked })}
            />
            Equalise empty gaps (Top / Right / Bottom / Left)
          </label>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {mode === "system"
              ? "General default. Type/sub-type settings override this in the Builder."
              : "Overrides General for beads that inherit this level."}
          </p>
        </Field>
        <Field label="Contact width" source={provenance?.contactWidth} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={editValues.contactWidth}
            onCommit={(contactWidth) => commitCalibration("contactWidth", contactWidth)}
            onEditingChange={(editing) => setFieldEditing("contactWidth", editing)}
            min={STRAND_CONTACT_SPACING_MIN}
            max={STRAND_CONTACT_SPACING_MAX}
            step={STRAND_CONTACT_SPACING_STEP}
            decimals={2}
            disabled={readOnly}
            aria-label="Contact width"
            clampOnCommit={false}
            onRangeError={(message) => setFieldError("contactWidth", message)}
            onClearError={() => setFieldError("contactWidth", null)}
          />
          <InputExamples examples={["-2", "0", "1", "2.5", "10"]} />
          <FieldError message={fieldErrors.contactWidth} />
        </Field>
        <Field label="Contact adjustment" source={provenance?.contactOffset} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={editValues.contactOffset}
            onCommit={(contactOffset) => commitCalibration("contactOffset", contactOffset)}
            onEditingChange={(editing) => setFieldEditing("contactOffset", editing)}
            min={STRAND_CONTACT_SPACING_MIN}
            max={STRAND_CONTACT_SPACING_MAX}
            step={STRAND_CONTACT_SPACING_STEP}
            decimals={2}
            disabled={readOnly}
            aria-label="Contact adjustment"
            clampOnCommit={false}
            onRangeError={(message) => setFieldError("contactOffset", message)}
            onClearError={() => setFieldError("contactOffset", null)}
          />
          <InputExamples examples={["-2", "-0.5", "0", "1", "2"]} />
          <FieldError message={fieldErrors.contactOffset} />
        </Field>
        <Field label="Render calibration" source={provenance?.visualScale} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={editValues.visualScale}
            onCommit={(visualScale) => commitCalibration("visualScale", visualScale)}
            onEditingChange={(editing) => setFieldEditing("visualScale", editing)}
            min={STRAND_VISUAL_SCALE_MIN}
            max={STRAND_VISUAL_SCALE_MAX}
            step={STRAND_VISUAL_SCALE_STEP}
            decimals={2}
            disabled={readOnly}
            aria-label="Render calibration"
            clampOnCommit={false}
            onRangeError={(message) => setFieldError("visualScale", message)}
            onClearError={() => setFieldError("visualScale", null)}
          />
          <InputExamples examples={["0.50", "0.90", "1", "1.08", "2.00"]} />
          <FieldError message={fieldErrors.visualScale} />
        </Field>
        <Field label="Anchor point" source={provenance?.anchorPreset} readOnly={readOnly}>
          <select
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.anchorPreset}
            onChange={(e) =>
              onChange({ anchorPreset: e.target.value as StrandAnchorPreset })
            }
          >
            <option value="center">Center</option>
            <option value="loop">Loop (top bail)</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </Field>
        <Field label="Orientation" source={provenance?.orientationMode} readOnly={readOnly}>
          <select
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.orientationMode}
            onChange={(e) =>
              onChange({ orientationMode: e.target.value as StrandOrientationMode })
            }
          >
            <option value="outward">Outward (face away from centre)</option>
            <option value="inward">Inward (face toward centre)</option>
          </select>
        </Field>
        <Field label="Vertical offset" source={provenance?.verticalOffset} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={editValues.verticalOffset}
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
          <InputExamples examples={["-5", "-2.5", "0", "3", "10"]} />
          <FieldError message={fieldErrors.verticalOffset} />
        </Field>
        <Field label="Z priority" source={provenance?.zPriority} readOnly={readOnly}>
          <AdminDeferredNumberInput
            value={value.zPriority}
            onCommit={(zPriority) => onChange({ zPriority: Math.round(zPriority) })}
            step={1}
            decimals={0}
            disabled={readOnly}
            aria-label="Z priority"
          />
        </Field>
      </div>

      {showAdvanced ? (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Field label="Leading overlap" source={provenance?.leadingOverlap} readOnly={readOnly}>
            <AdminDeferredNumberInput
              value={value.leadingOverlap}
              onCommit={(leadingOverlap) => onChange({ leadingOverlap })}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Trailing overlap" source={provenance?.trailingOverlap} readOnly={readOnly}>
            <AdminDeferredNumberInput
              value={value.trailingOverlap}
              onCommit={(trailingOverlap) => onChange({ trailingOverlap })}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={readOnly}
            />
          </Field>
          <Field label="Hang offset" source={provenance?.hangOffset} readOnly={readOnly}>
            <AdminNumberWithSlider
              value={value.hangOffset}
              onCommit={(hangOffset) => onChange({ hangOffset })}
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
          <Field
            label="Strand occupancy (legacy)"
            source={provenance?.strandOccupancy}
            readOnly={readOnly}
          >
            <AdminNumberWithSlider
              value={value.strandOccupancy}
              onCommit={(strandOccupancy) => onChange({ strandOccupancy })}
              min={0.05}
              max={2}
              step={0.01}
              decimals={2}
              disabled={readOnly}
              aria-label="Strand occupancy"
            />
          </Field>
          <Field label="Rotation (advanced)" source={provenance?.rotationMode} readOnly={readOnly}>
            <select
              disabled={readOnly}
              className={adminFieldClass()}
              value={value.rotationMode}
              onChange={(e) =>
                onChange({ rotationMode: e.target.value as StrandRotationMode })
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
              value={value.collisionPadding}
              onCommit={(collisionPadding) => onChange({ collisionPadding })}
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
              value={value.stringOcclusion}
              onCommit={(stringOcclusion) => onChange({ stringOcclusion })}
              min={0}
              max={1}
              step={0.05}
              decimals={2}
              disabled={readOnly}
            />
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
          className="border-t border-border pt-4"
          profile={previewProfile}
          imageUrl={previewImageUrl}
          sampleBead={previewSampleBead}
        />
      ) : null}
    </section>
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
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs text-muted-foreground">{label}</label>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      {children}
    </div>
  );
}

function InputExamples({ examples }: { examples: string[] }) {
  return (
    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
      Examples: {examples.join(" | ")}
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
