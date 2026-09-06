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
  type StrandRenderFieldGroup,
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

function partialInheritGuide(mode: "bead" | "subBeadType") {
  const systemLabel = "System defaults (General settings → Strand defaults)";
  if (mode === "subBeadType") {
    return {
      chain: [systemLabel, "Bead type", "This sub-type"],
      customizeOffDetail:
        "the bead type for that column, or system defaults if the bead type did not set it",
      customizeOnDetail: "the bead type (or system defaults for columns the type did not set)",
    };
  }
  return {
    chain: [systemLabel, "Bead type", "Sub-type", "This bead"],
    customizeOffDetail:
      "the sub-type, then the bead type, then system defaults — whichever is the nearest level above",
    customizeOnDetail:
      "the sub-type, bead type, or system defaults for columns you did not customize here",
  };
}

function InheritanceChain({ steps }: { steps: string[] }) {
  return (
    <p className="font-mono text-xs leading-relaxed text-foreground sm:text-sm">
      {steps.map((step, index) => (
        <span key={step}>
          {index > 0 ? <span className="text-muted-foreground"> → </span> : null}
          <span className={index === steps.length - 1 ? "font-semibold" : undefined}>{step}</span>
        </span>
      ))}
    </p>
  );
}

export interface StrandRenderConfigPanelProps {
  mode: StrandRenderConfigPanelMode;
  /** Effective values shown in the form. */
  value: StrandRenderProfile;
  /** Per-field provenance (bead mode only). */
  provenance?: Partial<Record<StrandRenderProfileKey, StrandRenderConfigSource>>;
  /** Per-field customize groups (bead / sub-type only). */
  customizedFields?: StrandRenderFieldGroup[];
  onFieldCustomizeChange?: (group: StrandRenderFieldGroup, enabled: boolean) => void;
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

/** Layout is the one public control — attach point follows (dangling → hanging ring, inline → center). */
function patchForLayoutMode(
  layoutMode: StrandRenderProfile["layoutMode"],
): Partial<StrandRenderProfile> {
  const dangling = layoutMode === "dangling";
  const anchorPreset: StrandAnchorPreset = dangling ? "loop" : "center";
  return {
    layoutMode,
    anchorPreset,
    ...anchorCoordsForPreset(anchorPreset),
    forceRoundFootprint: !dangling,
    rotationMode: dangling ? "radial-upright" : "tangent",
    ...(dangling ? {} : { hangOffset: 0 }),
  };
}

export function StrandRenderConfigPanel({
  mode,
  value,
  provenance,
  customizedFields = [],
  onFieldCustomizeChange,
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
  const supportsPartial = mode === "bead" || mode === "subBeadType";
  const isGroupCustomized = (group: StrandRenderFieldGroup) =>
    !supportsPartial || customizedFields.includes(group);
  const isGroupEditable = (group: StrandRenderFieldGroup) =>
    !disabled && isGroupCustomized(group);
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

  const hierarchyHint =
    mode === "system"
      ? "Platform-wide baseline. Bead type, sub-type, and bead overrides apply only where Customize is enabled."
      : mode === "beadType"
        ? "Baseline for this bead type. Sub-types and beads inherit these values unless they customize a column."
        : mode === "subBeadType"
          ? "Each column inherits from the bead type, then system defaults. Turn Customize on only where this sub-type should differ."
          : "Each column inherits from the sub-type, then bead type, then system defaults. Turn Customize on only where this bead should differ.";

  const inheritGuide = supportsPartial ? partialInheritGuide(mode) : null;

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

  const patchDraft = (patch: Partial<StrandRenderProfile>, group?: StrandRenderFieldGroup) => {
    if (disabled) return;
    if (supportsPartial && group && !isGroupCustomized(group)) return;
    for (const key of Object.keys(patch) as (keyof StrandRenderProfile)[]) {
      pendingCommitsRef.current[key] = patch[key];
    }
    setDraft((prev) => ({ ...prev, ...patch }));
    onChange(patch);
  };

  const commitCalibration = (key: CalibrationFieldKey, next: number, group?: StrandRenderFieldGroup) => {
    patchDraft({ [key]: next }, group);
  };

  const setFieldEditing = (key: CalibrationFieldKey, editing: boolean) => {
    if (editing) editingFieldsRef.current.add(key);
    else editingFieldsRef.current.delete(key);
  };

  const discardLocalEdits = () => {
    pendingCommitsRef.current = {};
    editingFieldsRef.current.clear();
  };

  const handleFieldCustomizeChange = (group: StrandRenderFieldGroup, enabled: boolean) => {
    discardLocalEdits();
    onFieldCustomizeChange?.(group, enabled);
  };

  const previewProfile = useMemo(() => draft, [draft]);

  return (
    <section className="space-y-2 rounded-xl border border-border bg-muted/15 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{hierarchyHint}</p>
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

      {inheritGuide ? (
        <div
          className="space-y-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
          role="note"
          aria-label="How column inheritance works"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">How each column works</p>
            <p className="text-sm leading-snug text-muted-foreground">
              When <span className="font-medium text-foreground">Customize</span> is off, values
              come from the nearest level above — not stored on this {mode === "bead" ? "bead" : "sub-type"}.
            </p>
          </div>

          <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inheritance order
            </p>
            <InheritanceChain steps={inheritGuide.chain} />
            <p className="text-xs leading-snug text-muted-foreground">
              Read left to right. If a level did not customize a column, the next level to the left
              supplies the value.
            </p>
          </div>

          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Customize off</span> — uses{" "}
              {inheritGuide.customizeOffDetail}. The field is greyed out and read-only.
            </li>
            <li>
              <span className="font-medium text-foreground">Customize on</span> — you set a local
              value for that column only. Other columns still follow{" "}
              {inheritGuide.customizeOnDetail}.
            </li>
            <li>
              Example: turn Customize on for{" "}
              <span className="font-medium text-foreground">Render size</span> to shrink one photo,
              while layout, gaps, orientation, and hang stay inherited.
            </li>
            <li>
              Uncheck Customize to drop the local value and follow the inheritance chain again.
            </li>
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {mode === "system" ? (
            <Field
              label="Visual size scaling"
              source={provenance?.visualSizeScaling}
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
                disabled={disabled}
                aria-label="Visual size scaling"
                clampOnCommit={false}
                onRangeError={(message) => setFieldError("visualSizeScaling", message)}
                onClearError={() => setFieldError("visualSizeScaling", null)}
              />
              <InputExamples examples={["0.50", "0.70", "1.00", "1.25"]} />
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                Controls how strongly size jumps between catalogue mm look (6 → 8 → 10&nbsp;mm) for
                crystals and charms. <span className="font-medium">1.00</span> = linear / natural.
                Lower = subtler differences. {STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM}&nbsp;mm stays
                fixed. Turn on Compare sizes in the preview (works for single-SKU dangling charms
                via a 6/8/10 preview ladder).
              </p>
              <FieldError message={fieldErrors.visualSizeScaling} />
            </Field>
          ) : (
            <>
              <FieldGroupCell
                group="visualScale"
                supportsPartial={supportsPartial}
                customized={isGroupCustomized("visualScale")}
                onCustomizeChange={handleFieldCustomizeChange}
                label={`Render size (image only) (${STRAND_VISUAL_SCALE_MIN.toFixed(2)}–${STRAND_VISUAL_SCALE_MAX.toFixed(2)})`}
                source={provenance?.visualScale}
              >
                <AdminDeferredNumberInput
                  value={draft.visualScale}
                  onCommit={(visualScale) =>
                    commitCalibration("visualScale", visualScale, "visualScale")
                  }
                  onEditingChange={(editing) => setFieldEditing("visualScale", editing)}
                  min={STRAND_VISUAL_SCALE_MIN}
                  max={STRAND_VISUAL_SCALE_MAX}
                  step={STRAND_VISUAL_SCALE_STEP}
                  decimals={2}
                  disabled={!isGroupEditable("visualScale")}
                  aria-label="Render size"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("visualScale", message)}
                  onClearError={() => setFieldError("visualScale", null)}
                />
                <InputExamples examples={["0.10", "0.50", "1.00", "1.25"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  How large the photo looks in the calibrated shell. Does not change gaps along the
                  cord.
                </p>
                <FieldError message={fieldErrors.visualScale} />
              </FieldGroupCell>

              <FieldGroupCell
                group="strandOccupancy"
                supportsPartial={supportsPartial}
                customized={isGroupCustomized("strandOccupancy")}
                onCustomizeChange={handleFieldCustomizeChange}
                label="Strand occupancy (gaps only)"
                source={provenance?.contactWidth}
              >
                <AdminDeferredNumberInput
                  value={effectiveStrandContactWidth({
                    contactWidth: draft.contactWidth,
                    contactOffset: draft.contactOffset,
                    spacingAdjustment: draft.spacingAdjustment,
                  })}
                  onCommit={(strandOccupancy) => {
                    patchDraft(
                      {
                        strandOccupancy,
                        contactWidth: 1,
                        contactOffset: strandOccupancy - 1,
                        spacingAdjustment: 0,
                      },
                      "strandOccupancy",
                    );
                  }}
                  onEditingChange={(editing) => setFieldEditing("strandOccupancy", editing)}
                  min={0}
                  max={STRAND_CONTACT_SPACING_MAX}
                  step={STRAND_CONTACT_SPACING_STEP}
                  decimals={2}
                  disabled={!isGroupEditable("strandOccupancy")}
                  aria-label="Strand occupancy"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("strandOccupancy", message)}
                  onClearError={() => setFieldError("strandOccupancy", null)}
                />
                <InputExamples examples={["0.70", "0.85", "1.00", "1.15"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Cord space relative to catalogue mm. Does not change photo size.
                </p>
                <FieldError message={fieldErrors.strandOccupancy} />
              </FieldGroupCell>

              <FieldGroupCell
                group="verticalOffset"
                supportsPartial={supportsPartial}
                customized={isGroupCustomized("verticalOffset")}
                onCustomizeChange={handleFieldCustomizeChange}
                label="Vertical offset"
                source={provenance?.verticalOffset}
              >
                <AdminDeferredNumberInput
                  value={draft.verticalOffset}
                  onCommit={(verticalOffset) =>
                    commitCalibration("verticalOffset", verticalOffset, "verticalOffset")
                  }
                  onEditingChange={(editing) => setFieldEditing("verticalOffset", editing)}
                  min={STRAND_VERTICAL_OFFSET_MIN}
                  max={STRAND_VERTICAL_OFFSET_MAX}
                  step={STRAND_VERTICAL_OFFSET_STEP}
                  decimals={1}
                  disabled={!isGroupEditable("verticalOffset")}
                  aria-label="Vertical offset"
                  clampOnCommit={false}
                  onRangeError={(message) => setFieldError("verticalOffset", message)}
                  onClearError={() => setFieldError("verticalOffset", null)}
                />
                <InputExamples examples={["-5", "0", "5", "10"]} />
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Moves the asset toward or away from the cord (% of item height).
                </p>
                <FieldError message={fieldErrors.verticalOffset} />
              </FieldGroupCell>

              <FieldGroupCell
                group="orientationMode"
                supportsPartial={supportsPartial}
                customized={isGroupCustomized("orientationMode")}
                onCustomizeChange={handleFieldCustomizeChange}
                label="Orientation"
                source={provenance?.orientationMode}
              >
                <select
                  disabled={!isGroupEditable("orientationMode")}
                  className={fieldClass(!isGroupEditable("orientationMode"))}
                  value={draft.orientationMode}
                  onChange={(e) =>
                    patchDraft(
                      { orientationMode: e.target.value as StrandOrientationMode },
                      "orientationMode",
                    )
                  }
                >
                  <option value="outward">Outward (away from centre)</option>
                  <option value="inward">Inward (toward centre)</option>
                </select>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Which way the asset faces on the bracelet.{" "}
                  <span className="font-medium">Outward</span> = decorative side points away from
                  the wrist centre (typical for crystals and charms).{" "}
                  <span className="font-medium">Inward</span> = toward the centre.
                </p>
                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!isGroupEditable("orientationMode")}
                    checked={draft.mirrorTowardNeighbour === true}
                    onChange={(e) =>
                      patchDraft({ mirrorTowardNeighbour: e.target.checked }, "orientationMode")
                    }
                  />
                  <span>
                    <span className="font-medium">Face the neighbouring bead.</span> Flips the
                    image so an asymmetric piece — a bead cap — opens toward the bead beside it,
                    whichever side it lands on. One upload covers both. Left alone when there are
                    beads on both sides or neither.
                  </span>
                </label>
              </FieldGroupCell>

              <FieldGroupCell
                group="layoutMode"
                supportsPartial={supportsPartial}
                customized={isGroupCustomized("layoutMode")}
                onCustomizeChange={handleFieldCustomizeChange}
                label="Layout mode"
                source={provenance?.layoutMode}
              >
                <select
                  disabled={!isGroupEditable("layoutMode")}
                  className={fieldClass(!isGroupEditable("layoutMode"))}
                  value={draft.layoutMode}
                  onChange={(e) =>
                    patchDraft(
                      patchForLayoutMode(e.target.value as StrandRenderProfile["layoutMode"]),
                      "layoutMode",
                    )
                  }
                >
                  <option value="inline">Inline (on the cord)</option>
                  <option value="dangling">Dangling (hangs from ring)</option>
                </select>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  Inline = on cord. Dangling = hangs from ring.
                </p>
              </FieldGroupCell>
            </>
          )}
        </div>
      </div>

      {showAdvanced ? (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <SectionHeading title="Advanced" />
          <FieldGroupCell
            group="layoutScale"
            supportsPartial={supportsPartial}
            customized={isGroupCustomized("layoutScale")}
            onCustomizeChange={handleFieldCustomizeChange}
            label="Layout scale"
            source={provenance?.layoutScale}
          >
            <AdminDeferredNumberInput
              value={draft.layoutScale}
              onCommit={(layoutScale) =>
                commitCalibration("layoutScale", layoutScale, "layoutScale")
              }
              onEditingChange={(editing) => setFieldEditing("layoutScale", editing)}
              min={STRAND_LAYOUT_SCALE_MIN}
              max={STRAND_LAYOUT_SCALE_MAX}
              step={STRAND_LAYOUT_SCALE_STEP}
              decimals={2}
              disabled={!isGroupEditable("layoutScale")}
              aria-label="Layout scale"
              clampOnCommit={false}
              onRangeError={(message) => setFieldError("layoutScale", message)}
              onClearError={() => setFieldError("layoutScale", null)}
            />
            <FieldError message={fieldErrors.layoutScale} />
          </FieldGroupCell>
          <FieldGroupCell
            group="leadingOverlap"
            supportsPartial={supportsPartial}
            customized={isGroupCustomized("leadingOverlap")}
            onCustomizeChange={handleFieldCustomizeChange}
            label="Leading overlap"
            source={provenance?.leadingOverlap}
          >
            <AdminDeferredNumberInput
              value={draft.leadingOverlap}
              onCommit={(leadingOverlap) => patchDraft({ leadingOverlap }, "leadingOverlap")}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={!isGroupEditable("leadingOverlap")}
            />
          </FieldGroupCell>
          <FieldGroupCell
            group="trailingOverlap"
            supportsPartial={supportsPartial}
            customized={isGroupCustomized("trailingOverlap")}
            onCustomizeChange={handleFieldCustomizeChange}
            label="Trailing overlap"
            source={provenance?.trailingOverlap}
          >
            <AdminDeferredNumberInput
              value={draft.trailingOverlap}
              onCommit={(trailingOverlap) => patchDraft({ trailingOverlap }, "trailingOverlap")}
              min={0}
              max={0.5}
              step={0.01}
              decimals={2}
              disabled={!isGroupEditable("trailingOverlap")}
            />
          </FieldGroupCell>
          <FieldGroupCell
            group="anchorPreset"
            supportsPartial={supportsPartial}
            customized={isGroupCustomized("anchorPreset")}
            onCustomizeChange={handleFieldCustomizeChange}
            label="Attach point (advanced)"
            source={provenance?.anchorPreset}
          >
            <select
              disabled={!isGroupEditable("anchorPreset")}
              className={fieldClass(!isGroupEditable("anchorPreset"))}
              value={draft.anchorPreset}
              onChange={(e) => {
                const anchorPreset = e.target.value as StrandAnchorPreset;
                patchDraft(
                  { anchorPreset, ...anchorCoordsForPreset(anchorPreset) },
                  "anchorPreset",
                );
              }}
            >
              <option value="center">Center</option>
              <option value="loop">Loop (hanging ring)</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </FieldGroupCell>
          <FieldGroupCell
            group="hangOffset"
            supportsPartial={supportsPartial}
            customized={isGroupCustomized("hangOffset")}
            onCustomizeChange={handleFieldCustomizeChange}
            label="Hang offset"
            source={provenance?.hangOffset}
          >
            <AdminNumberWithSlider
              value={draft.hangOffset}
              onCommit={(hangOffset) => patchDraft({ hangOffset }, "hangOffset")}
              min={-1}
              max={1}
              step={0.01}
              displayScale={100}
              decimals={0}
              disabled={!isGroupEditable("hangOffset")}
              aria-label="Hang offset percent"
            />
          </FieldGroupCell>
          {mode === "system" ? (
            <Field label="Layout mode" source={provenance?.layoutMode}>
              <select
                disabled={disabled}
                className={fieldClass(disabled)}
                value={draft.layoutMode}
                onChange={(e) =>
                  patchDraft(patchForLayoutMode(e.target.value as StrandRenderProfile["layoutMode"]))
                }
              >
                <option value="inline">Inline</option>
                <option value="dangling">Dangling</option>
              </select>
            </Field>
          ) : null}
        </div>
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

function FieldGroupCell({
  group,
  supportsPartial,
  customized,
  onCustomizeChange,
  label,
  source,
  children,
}: {
  group: StrandRenderFieldGroup;
  supportsPartial: boolean;
  customized: boolean;
  onCustomizeChange?: (group: StrandRenderFieldGroup, enabled: boolean) => void;
  label: string;
  source?: StrandRenderConfigSource;
  children: ReactNode;
}) {
  const locked = supportsPartial && !customized;
  return (
    <div className={locked ? "min-w-0 rounded-md border border-transparent opacity-75" : "min-w-0"}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <div className="flex shrink-0 items-center gap-2">
          {supportsPartial && onCustomizeChange ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-border accent-foreground"
                checked={customized}
                onChange={(e) => onCustomizeChange(group, e.target.checked)}
                aria-label={`Customize ${label}`}
              />
              Customize
            </label>
          ) : null}
          {supportsPartial && !customized ? (
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Inherited
            </span>
          ) : null}
          {source ? <SourceBadge source={source} /> : null}
        </div>
      </div>
      <div className={locked ? "pointer-events-none" : undefined}>{children}</div>
    </div>
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
