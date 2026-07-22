import type { LensClipRenderSettings } from "./lens-clip.js";

/** Material keys that participate in the preset hierarchy (admin-editable optics). */
export const LENS_RENDER_PRESET_KEYS = [
  "automaticMaterialBehavior",
  "originalLensColorInfluence",
  "materialInfluence",
  "baseBrightness",
  "baseGamma",
  "glassAbsorption",
  "glassDiffusion",
  "glassDepth",
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
  "brightness",
  "contrast",
  "saturation",
  "gradientEnabled",
  "gradientTopColor",
  "gradientBottomColor",
  "gradientPosition",
  "gradientStrength",
  "reflectionEnabled",
  "reflectionStrength",
  "reflectionAngle",
  "reflectionBlur",
  "reflectionPosition",
  "reflectionOffsetX",
  "reflectionOffsetY",
  "reflectionScale",
  "internalReflectionEnabled",
  "internalReflectionOpacity",
  "internalReflectionSoftness",
  "internalReflectionScale",
  "internalReflectionAngle",
  "fresnelEnabled",
  "fresnelStrength",
  "fresnelWidth",
  "fresnelSoftness",
  "glossEnabled",
  "glossStrength",
  "vignetteEnabled",
  "edgeFade",
  "edgeWidth",
  "edgeSoftness",
  "edgeOpacity",
  "polarizedEnabled",
  "polarizedStrength",
] as const satisfies readonly (keyof LensClipRenderSettings)[];

export type LensRenderPresetKey = (typeof LENS_RENDER_PRESET_KEYS)[number];

export type LensRenderConfigSource = "system" | "preset" | "frameOverride";

/** `config_kv` key for the single platform-wide lens material fallback. */
export const LENS_RENDER_SYSTEM_DEFAULTS_KEY = "sunglasses.lens_render_defaults_v1";

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

/** Reusable database record that copies starting values into any editable hierarchy level. */
export interface LensMaterialProfile {
  id: string;
  code: string;
  name: string;
  description: string;
  settings: LensClipRenderSettings;
  displayOrder: number;
  isActive: boolean;
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
    | "automaticMaterialBehavior"
    | "originalLensColorInfluence"
    | "materialInfluence"
    | "baseBrightness"
    | "baseGamma"
    | "glassAbsorption"
    | "glassDiffusion"
    | "glassDepth"
    | "tintLayerOpacity"
    | "lensOpacity"
    | "lensTransmission"
    | "reflectionOpacity"
    | "internalReflectionOpacity"
    | "fresnelStrength"
    | "edgeDarkness"
    | "edgeOpacity"
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
  Pick<LensClipRenderSettings, LensRenderPresetKey>
> = {
  automaticMaterialBehavior: true,
  originalLensColorInfluence: 15,
  materialInfluence: 35,
  baseBrightness: 0,
  baseGamma: 1,
  glassAbsorption: 30,
  glassDiffusion: 18,
  glassDepth: 50,
  tintLayerOpacity: 0.42978,
  lensOpacity: 0.9,
  reflectionOpacity: 0.2,
  edgeDarkness: 0.24,
  backgroundVisibility: 0,
  environmentTransparency: 0,
  centerDensity: 0,
  edgeDensity: 0.18,
  tintOpacity: 0.78,
  lensTransmission: 0.42,
  frameExclusionOpacity: 1,
  brightness: 1.02,
  contrast: 1.04,
  saturation: 0.98,
  gradientEnabled: true,
  gradientTopColor: null,
  gradientBottomColor: null,
  gradientPosition: 45,
  gradientStrength: 0.24,
  reflectionEnabled: true,
  reflectionStrength: 0.42,
  reflectionAngle: 22,
  reflectionBlur: 0.58,
  reflectionPosition: -10,
  reflectionOffsetX: -10,
  reflectionOffsetY: -8,
  reflectionScale: 1.1,
  internalReflectionEnabled: true,
  internalReflectionOpacity: 0.04,
  internalReflectionSoftness: 0.86,
  internalReflectionScale: 0.92,
  internalReflectionAngle: 338,
  fresnelEnabled: true,
  fresnelStrength: 0.12,
  fresnelWidth: 0.18,
  fresnelSoftness: 0.72,
  glossEnabled: true,
  glossStrength: 0.14,
  vignetteEnabled: true,
  edgeFade: 0.12,
  edgeWidth: 0.006,
  edgeSoftness: 0.68,
  edgeOpacity: 0.24,
  polarizedEnabled: false,
  polarizedStrength: 0.12,
};

/**
 * Identity optical settings. Most effects are zero; controls whose neutral point is not
 * zero use their mathematical identity (`baseGamma = 1`).
 * Used by the admin "Show original lens" preview in the same rendering pipeline.
 */
export const LENS_RENDER_ZERO_SETTINGS: Required<
  Pick<
    LensClipRenderSettings,
    | "automaticMaterialBehavior"
    | "originalLensColorInfluence"
    | "materialInfluence"
    | "baseBrightness"
    | "baseGamma"
    | "glassAbsorption"
    | "glassDiffusion"
    | "glassDepth"
    | "tintLayerOpacity"
    | "lensOpacity"
    | "lensTransmission"
    | "reflectionOpacity"
    | "internalReflectionOpacity"
    | "fresnelStrength"
    | "edgeDarkness"
    | "edgeOpacity"
    | "backgroundVisibility"
    | "environmentTransparency"
    | "centerDensity"
    | "edgeDensity"
    | "gradientStrength"
    | "reflectionStrength"
    | "edgeFade"
    | "polarizedStrength"
  >
> & {
  reflectionEnabled: boolean;
  internalReflectionEnabled: boolean;
  fresnelEnabled: boolean;
  vignetteEnabled: boolean;
  gradientEnabled: boolean;
  polarizedEnabled: boolean;
} = {
  automaticMaterialBehavior: false,
  originalLensColorInfluence: 100,
  materialInfluence: 100,
  baseBrightness: 0,
  // Gamma's identity value is not numerically zero.
  baseGamma: 1,
  glassAbsorption: 0,
  glassDiffusion: 0,
  glassDepth: 0,
  tintLayerOpacity: 0,
  lensOpacity: 0,
  lensTransmission: 1,
  reflectionOpacity: 0,
  internalReflectionOpacity: 0,
  fresnelStrength: 0,
  edgeDarkness: 0,
  edgeOpacity: 0,
  backgroundVisibility: 0,
  environmentTransparency: 0,
  centerDensity: 0,
  edgeDensity: 0,
  gradientStrength: 0,
  reflectionStrength: 0,
  edgeFade: 0,
  polarizedStrength: 0,
  reflectionEnabled: false,
  internalReflectionEnabled: false,
  fresnelEnabled: false,
  vignetteEnabled: false,
  gradientEnabled: false,
  polarizedEnabled: false,
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
  // Pre-000077 payloads used glassMaterialStrength; promote it into the current key.
  if (out.materialInfluence === undefined && isFiniteNumber(input.glassMaterialStrength)) {
    out.materialInfluence = input.glassMaterialStrength;
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
    automaticMaterialBehavior:
      settings.automaticMaterialBehavior ??
      LENS_RENDER_SYSTEM_DEFAULTS.automaticMaterialBehavior,
    originalLensColorInfluence:
      settings.originalLensColorInfluence ??
      LENS_RENDER_SYSTEM_DEFAULTS.originalLensColorInfluence,
    materialInfluence:
      settings.materialInfluence ?? LENS_RENDER_SYSTEM_DEFAULTS.materialInfluence,
    baseBrightness: settings.baseBrightness ?? LENS_RENDER_SYSTEM_DEFAULTS.baseBrightness,
    baseGamma: settings.baseGamma ?? LENS_RENDER_SYSTEM_DEFAULTS.baseGamma,
    glassAbsorption:
      settings.glassAbsorption ?? LENS_RENDER_SYSTEM_DEFAULTS.glassAbsorption,
    glassDiffusion:
      settings.glassDiffusion ?? LENS_RENDER_SYSTEM_DEFAULTS.glassDiffusion,
    glassDepth: settings.glassDepth ?? LENS_RENDER_SYSTEM_DEFAULTS.glassDepth,
    tintLayerOpacity: settings.tintLayerOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.tintLayerOpacity,
    lensOpacity: settings.lensOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.lensOpacity,
    lensTransmission:
      settings.lensTransmission ?? LENS_RENDER_SYSTEM_DEFAULTS.lensTransmission,
    reflectionOpacity: settings.reflectionOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.reflectionOpacity,
    internalReflectionOpacity:
      settings.internalReflectionOpacity ??
      LENS_RENDER_SYSTEM_DEFAULTS.internalReflectionOpacity,
    fresnelStrength:
      settings.fresnelStrength ?? LENS_RENDER_SYSTEM_DEFAULTS.fresnelStrength,
    edgeDarkness: settings.edgeDarkness ?? LENS_RENDER_SYSTEM_DEFAULTS.edgeDarkness,
    edgeOpacity: settings.edgeOpacity ?? LENS_RENDER_SYSTEM_DEFAULTS.edgeOpacity,
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
