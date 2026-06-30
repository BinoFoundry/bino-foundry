import type { ReactNode } from "react";
import {
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  strandRenderSourceLabel,
  type StrandAnchorPreset,
  type StrandRenderConfigSource,
  type StrandRenderProfile,
  type StrandRenderProfileKey,
  type StrandRotationMode,
} from "@bino-foundry/shared/types";

import { adminFieldClass } from "./admin-styles";

export type StrandRenderConfigPanelMode = "system" | "beadType" | "bead";

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
}

function SourceBadge({ source }: { source?: StrandRenderConfigSource }) {
  if (!source) return null;
  const label =
    source === "system"
      ? "AUTO (System default)"
      : source === "beadType"
        ? "AUTO (Inherited from bead type)"
        : "Custom override";
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
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
}: StrandRenderConfigPanelProps) {
  const readOnly = disabled || (mode === "bead" && inheritTypeDefaults);
  const title =
    mode === "system"
      ? "System rendering defaults"
      : mode === "beadType"
        ? "Bead type rendering defaults"
        : "Strand appearance";

  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {mode === "system"
              ? "Fallback for all bead types and assets."
              : mode === "beadType"
                ? "Inherited by every bead of this type unless individually overridden."
                : "Optional overrides for this asset only."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "bead" && onResetToType ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={onResetToType}
            >
              Reset to bead type
            </button>
          ) : null}
          {mode !== "system" && onResetToSystem ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={onResetToSystem}
            >
              Reset to system defaults
            </button>
          ) : null}
        </div>
      </div>

      {mode === "bead" && onInheritTypeDefaultsChange ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inheritTypeDefaults}
            onChange={(e) => onInheritTypeDefaultsChange(e.target.checked)}
          />
          Use bead type defaults
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Strand occupancy"
          source={provenance?.strandOccupancy}
          readOnly={readOnly}
        >
          <input
            type="number"
            step="0.01"
            min={0.05}
            max={2}
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.strandOccupancy}
            onChange={(e) => onChange({ strandOccupancy: Number(e.target.value) })}
          />
        </Field>
        <Field label="Visual scale" source={provenance?.visualScale} readOnly={readOnly}>
          <input
            type="number"
            step="0.05"
            min={0.25}
            max={3}
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.visualScale}
            onChange={(e) => onChange({ visualScale: Number(e.target.value) })}
          />
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
        <Field label="Rotation" source={provenance?.rotationMode} readOnly={readOnly}>
          <select
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.rotationMode}
            onChange={(e) =>
              onChange({ rotationMode: e.target.value as StrandRotationMode })
            }
          >
            <option value="tangent">Rotate with strand</option>
            <option value="radial-upright">Face outward</option>
            <option value="fixed-upright">Stay upright</option>
            <option value="none">No rotation</option>
          </select>
        </Field>
        <Field label="Vertical offset" source={provenance?.verticalOffset} readOnly={readOnly}>
          <input
            type="number"
            step="0.01"
            min={-1}
            max={1}
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.verticalOffset}
            onChange={(e) => onChange({ verticalOffset: Number(e.target.value) })}
          />
        </Field>
        <Field label="Z priority" source={provenance?.zPriority} readOnly={readOnly}>
          <input
            type="number"
            step="1"
            disabled={readOnly}
            className={adminFieldClass()}
            value={value.zPriority}
            onChange={(e) => onChange({ zPriority: Number(e.target.value) })}
          />
        </Field>
      </div>

      {showAdvanced ? (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Field
            label="Collision padding (px)"
            source={provenance?.collisionPadding}
            readOnly={readOnly}
          >
            <input
              type="number"
              step="0.5"
              min={0}
              max={20}
              disabled={readOnly}
              className={adminFieldClass()}
              value={value.collisionPadding}
              onChange={(e) => onChange({ collisionPadding: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="String occlusion (0–1)"
            source={provenance?.stringOcclusion}
            readOnly={readOnly}
          >
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              disabled={readOnly}
              className={adminFieldClass()}
              value={value.stringOcclusion}
              onChange={(e) => onChange({ stringOcclusion: Number(e.target.value) })}
            />
          </Field>
        </div>
      ) : null}

      {mode === "bead" && inheritTypeDefaults ? (
        <p className="text-xs text-muted-foreground">
          Using bead type values ({strandRenderSourceLabel("beadType")}).
        </p>
      ) : null}
    </section>
  );
}

function Field({
  label,
  source,
  readOnly,
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
        {!readOnly && source ? <SourceBadge source={source} /> : null}
      </div>
      {children}
    </div>
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
