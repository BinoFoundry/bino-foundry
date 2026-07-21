import type { LensClipRenderSettings } from "./lens-clip.js";

/** Material keys that participate in the preset hierarchy (admin-editable optics). */
export const LENS_RENDER_PRESET_KEYS = [
  "tintLayerOpacity",
  "lensOpacity",
  "reflectionOpacity",
  "edgeDarkness",
  "backgroundVisibility",
  "environmentTransparency",
  "centerDensity",
  "edgeDensity",
  "tintOpacity",
  "lensTransmission",
  "frameExclusionOpacity",
  "gradientEnabled",
  "gradientStrength",
  "reflectionEnabled",
  "reflectionStrength",
  "reflectionAngle",
  "reflectionBlur",
  "vignetteEnabled",
  "edgeFade",
  "edgeWidth",
  "polarizedEnabled",
  "polarizedStrength",
] as const satisfies readonly (keyof LensClipRenderSettings)[];

export type LensRenderPresetKey = (typeof LENS_RENDER_PRESET_KEYS)[number];

export type LensRenderConfigSource = "system" | "preset" | "frameOverride";

/** Named editable preset stored in `lens_rendering_presets`. */
export interface LensRenderingPreset {
  id: string;
  code: string;
  name: string;
  description: string;
  settings: LensClipRenderSettings;
  displayOrder: number;
  isActive: boolean;
  isDefault: boolean;
  /** Built-in presets cannot be deleted (Clear / Light / Classic / Dark). */
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LensRenderConfigLayers {
  /** Ultimate code fallback (DEFAULT_LENS_CLIP_RENDER). */
  systemDefaults?: LensClipRenderSettings | null;
  /** Assigned preset settings from the database. */
  preset?: LensClipRenderSettings | null;
  /**
   * Sparse frame override. Applied only when `usePreset` is false.
   * Only keys present in the override replace inherited values.
   */
  frameOverride?: LensClipRenderSettings | null;
  /** When true (default), frame inherits the preset and ignores frameOverride material keys. */
  usePreset?: boolean;
}

export type ResolvedLensRenderMaterial = Required<
  Pick<
    LensClipRenderSettings,
    | "tintLayerOpacity"
    | "lensOpacity"
    | "reflectionOpacity"
    | "edgeDarkness"
    | "backgroundVisibility"
    | "environmentTransparency"
    | "centerDensity"
    | "edgeDensity"
  >
> &
  LensClipRenderSettings & {
    provenance: Record<LensRenderPresetKey, LensRenderConfigSource>;
    source: LensRenderConfigSource;
  };

/** Code-level system defaults — last-resort fallback when no preset is assigned. */
export const LENS_RENDER_SYSTEM_DEFAULTS: Required<
  Pick<
    LensClipRenderSettings,
    | "tintLayerOpacity"
    | "lensOpacity"
    | "reflectionOpacity"
    | "edgeDarkness"
    | "backgroundVisibility"
    | "environmentTransparency"
    | "centerDensity"
    | "edgeDensity"
  >
> = {
  tintLayerOpacity: 0.42978,
  lensOpacity: 0.9,
  reflectionOpacity: 0.2,
  edgeDarkness: 0.24,
  backgroundVisibility: 0,
  environmentTransparency: 0,
  centerDensity: 0,
  edgeDensity: 0.18,
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Pick only known material keys that are explicitly set (sparse override support). */
export function pickLensRenderPresetSettings(
  input: LensClipRenderSettings | null | undefined,
): LensClipRenderSettings {
  if (!input) return {};
  const out: LensClipRenderSettings = {};
  for (const key of LENS_RENDER_PRESET_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Build a sparse override containing only keys that differ from the inherited baseline.
 * Empty result means the frame fully inherits the preset.
 */
export function pruneLensRenderOverride(
  inherited: LensClipRenderSettings,
  candidate: LensClipRenderSettings | null | undefined,
): LensClipRenderSettings {
  if (!candidate) return {};
  const out: LensClipRenderSettings = {};
  for (const key of LENS_RENDER_PRESET_KEYS) {
    const next = candidate[key];
    if (next === undefined) continue;
    const base = inherited[key];
    if (isFiniteNumber(next) && isFiniteNumber(base)) {
      if (Math.abs(next - base) < 1e-6) continue;
    } else if (next === base) {
      continue;
    }
    (out as Record<string, unknown>)[key] = next;
  }
  return out;
}

function applyLayer(
  current: LensClipRenderSettings,
  partial: LensClipRenderSettings | null | undefined,
  source: LensRenderConfigSource,
  provenance: Record<LensRenderPresetKey, LensRenderConfigSource>,
): LensClipRenderSettings {
  if (!partial) return current;
  const next = { ...current };
  for (const key of LENS_RENDER_PRESET_KEYS) {
    if (partial[key] === undefined) continue;
    (next as Record<string, unknown>)[key] = partial[key];
    provenance[key] = source;
  }
  return next;
}

/**
 * Resolve lens material settings:
 * Frame Override → Preset → System Default.
 *
 * When `usePreset` is true (default), frameOverride is ignored so linked frames
 * automatically reflect preset edits.
 */
export function resolveLensRenderConfig(
  layers: LensRenderConfigLayers,
): ResolvedLensRenderMaterial {
  const provenance = Object.fromEntries(
    LENS_RENDER_PRESET_KEYS.map((key) => [key, "system" as LensRenderConfigSource]),
  ) as Record<LensRenderPresetKey, LensRenderConfigSource>;

  let settings: LensClipRenderSettings = {
    ...LENS_RENDER_SYSTEM_DEFAULTS,
    ...(layers.systemDefaults ?? {}),
  };

  settings = applyLayer(settings, layers.preset, "preset", provenance);

  const usePreset = layers.usePreset !== false;
  if (!usePreset) {
    settings = applyLayer(settings, layers.frameOverride, "frameOverride", provenance);
  }

  const anyOverride = LENS_RENDER_PRESET_KEYS.some((k) => provenance[k] === "frameOverride");
  const anyPreset = LENS_RENDER_PRESET_KEYS.some((k) => provenance[k] === "preset");
  const source: LensRenderConfigSource = anyOverride
    ? "frameOverride"
    : anyPreset
      ? "preset"
      : "system";

  return {
    ...settings,
    tintLayerOpacity: settings.tintLayerOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.tintLayerOpacity,
    lensOpacity: settings.lensOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.lensOpacity,
    reflectionOpacity: settings.reflectionOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.reflectionOpacity,
    edgeDarkness: settings.edgeDarkness ?? LENS_RENDER_SYSTEM_DEFAULTS.edgeDarkness,
    backgroundVisibility:
      settings.backgroundVisibility ?? LENS_RENDER_SYSTEM_DEFAULTS.backgroundVisibility,
    environmentTransparency:
      settings.environmentTransparency ?? LENS_RENDER_SYSTEM_DEFAULTS.environmentTransparency,
    centerDensity: settings.centerDensity ?? LENS_RENDER_SYSTEM_DEFAULTS.centerDensity,
    edgeDensity: settings.edgeDensity ?? LENS_RENDER_SYSTEM_DEFAULTS.edgeDensity,
    provenance,
    source,
  };
}

export function lensRenderSourceLabel(source: LensRenderConfigSource): string {
  switch (source) {
    case "frameOverride":
      return "Using Override";
    case "preset":
      return "Using Preset";
    default:
      return "Using System Default";
  }
}
