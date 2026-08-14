import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  type StrandRenderProfile,
} from "./strand-render-profile.js";

/** `config_kv` key for platform-wide strand rendering defaults. */
export const STRAND_RENDER_SYSTEM_DEFAULTS_KEY = "bracelet.strand_render_defaults_v1";

export type StrandRenderConfigSource = "system" | "beadType" | "subBeadType" | "beadOverride";

export type StrandRenderProfileKey = keyof StrandRenderProfile;

export interface ResolvedStrandRenderConfig extends StrandRenderProfile {
  /** Which hierarchy level supplied each property (for admin display). */
  provenance: Record<StrandRenderProfileKey, StrandRenderConfigSource>;
  /**
   * Final visual render calibration after hierarchy resolve.
   * Alias of {@link StrandRenderProfile.visualScale} — renderer should use this only.
   */
  resolvedRenderScale: number;
  /**
   * Opt-in photo size nudge (1 = unchanged). Independent of visualScale / packing / hang.
   * Only set when Customize image size is enabled on that catalogue level.
   */
  imageSizeAdjust: number;
}

export const STRAND_RENDER_PROFILE_KEYS = [
  "layoutScale",
  "balanceSpacing",
  "attachmentStyle",
  "strandOccupancy",
  "contactWidth",
  "layoutMode",
  "contactOffset",
  "spacingAdjustment",
  "leadingOverlap",
  "trailingOverlap",
  "hangOffset",
  "anchorPreset",
  "anchorX",
  "anchorY",
  "verticalOffset",
  "visualScale",
  "visualSizeScaling",
  "orientationMode",
  "rotationMode",
  "rotationOffsetDeg",
  "collisionPadding",
  "stringOcclusion",
  "forceRoundFootprint",
  "preferStrandImageUrl",
  "placementMode",
] as const satisfies readonly StrandRenderProfileKey[];

export interface StrandRenderConfigLayers {
  systemDefaults?: Partial<StrandRenderProfile> | null;
  beadTypeDefaults?: Partial<StrandRenderProfile> | null;
  /** Partial override when sub type does not fully inherit bead type. */
  subBeadTypeOverride?: Partial<StrandRenderProfile> | null;
  /** When true (default), sub type inherits bead type tier. */
  inheritSubBeadTypeFromBeadType?: boolean;
  /** Opt-in image size nudge for this sub-type (1 = off / unchanged). */
  imageSizeAdjustSubBeadType?: number | null;
  beadOverride?: Partial<StrandRenderProfile> | null;
  /** When true (default), bead inherits sub bead type tier. */
  inheritBeadFromSubBeadType?: boolean;
  /** Opt-in image size nudge for this bead (1 = off / unchanged). Wins over sub-type. */
  imageSizeAdjustBead?: number | null;
  /**
   * @deprecated Use inheritBeadFromSubBeadType. Kept for backward compatibility.
   * When set, overrides inheritBeadFromSubBeadType.
   */
  inheritTypeDefaults?: boolean;
}

function explicitKeys(partial: Partial<StrandRenderProfile> | null | undefined): StrandRenderProfileKey[] {
  if (!partial) return [];
  return STRAND_RENDER_PROFILE_KEYS.filter((key) => partial[key] !== undefined);
}

function applyLayer(
  current: StrandRenderProfile,
  partial: Partial<StrandRenderProfile> | null | undefined,
  source: StrandRenderConfigSource,
  provenance: Record<StrandRenderProfileKey, StrandRenderConfigSource>,
): StrandRenderProfile {
  if (!partial) return current;
  const next = mergeStrandRenderProfile(current, partial);
  for (const key of explicitKeys(partial)) {
    provenance[key] = source;
  }
  return next;
}

function beadInheritsSubType(layers: StrandRenderConfigLayers): boolean {
  if (layers.inheritTypeDefaults !== undefined) {
    return layers.inheritTypeDefaults !== false;
  }
  return layers.inheritBeadFromSubBeadType !== false;
}

function normalizeImageSizeAdjust(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * Resolve strand rendering config:
 * system → bead type → sub bead type → bead override.
 * Renderer consumes only the returned profile fields; provenance is for admin UI.
 * imageSizeAdjust is opt-in and never rewrites visualScale / hang / occupancy.
 */
export function resolveStrandRenderConfig(layers: StrandRenderConfigLayers): ResolvedStrandRenderConfig {
  const provenance = Object.fromEntries(
    STRAND_RENDER_PROFILE_KEYS.map((key) => [key, "system" as StrandRenderConfigSource]),
  ) as Record<StrandRenderProfileKey, StrandRenderConfigSource>;

  let profile = { ...DEFAULT_STRAND_RENDER_PROFILE };
  profile = applyLayer(profile, layers.systemDefaults, "system", provenance);
  profile = applyLayer(profile, layers.beadTypeDefaults, "beadType", provenance);

  const inheritSubFromType = layers.inheritSubBeadTypeFromBeadType !== false;
  if (!inheritSubFromType) {
    profile = applyLayer(profile, layers.subBeadTypeOverride, "subBeadType", provenance);
  }

  if (!beadInheritsSubType(layers)) {
    profile = applyLayer(profile, layers.beadOverride, "beadOverride", provenance);
  }

  const subAdjust = normalizeImageSizeAdjust(layers.imageSizeAdjustSubBeadType);
  const beadAdjust = normalizeImageSizeAdjust(layers.imageSizeAdjustBead);
  const imageSizeAdjust = beadAdjust ?? subAdjust ?? 1;

  return { ...profile, provenance, resolvedRenderScale: profile.visualScale, imageSizeAdjust };
}

/** @deprecated Kept for callers that still import the old helper name. */
export function pickStrandRenderSizeOverride(
  override: Partial<StrandRenderProfile> | null | undefined,
): Partial<StrandRenderProfile> | null {
  if (typeof override?.visualScale !== "number" || !Number.isFinite(override.visualScale)) {
    return null;
  }
  return { visualScale: override.visualScale };
}

export function parseStrandRenderConfigFromMetadata(
  raw: unknown,
): Partial<StrandRenderProfile> | null {
  return parseStrandRenderProfile(raw);
}

/** Human-readable admin label for a config source. */
export function strandRenderSourceLabel(source: StrandRenderConfigSource): string {
  switch (source) {
    case "beadOverride":
      return "Custom Override";
    case "subBeadType":
      return "AUTO (Sub Bead Type)";
    case "beadType":
      return "AUTO (Bead Type)";
    case "system":
    default:
      return "AUTO (System Default)";
  }
}

/** Renderer-facing alias for the resolved hierarchical visual scale. */
export function resolvedRenderScale(
  profile: Pick<StrandRenderProfile, "visualScale">,
): number {
  const scale = profile.visualScale;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return scale;
}
