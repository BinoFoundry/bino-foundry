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
}

export const STRAND_RENDER_PROFILE_KEYS = [
  "layoutScale",
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
  "orientationMode",
  "rotationMode",
  "rotationOffsetDeg",
  "zPriority",
  "collisionPadding",
  "stringOcclusion",
  "forceRoundFootprint",
  "preferStrandImageUrl",
] as const satisfies readonly StrandRenderProfileKey[];

export interface StrandRenderConfigLayers {
  systemDefaults?: Partial<StrandRenderProfile> | null;
  beadTypeDefaults?: Partial<StrandRenderProfile> | null;
  /** Partial override when sub type does not fully inherit bead type. */
  subBeadTypeOverride?: Partial<StrandRenderProfile> | null;
  /** When true (default), sub type inherits bead type tier. */
  inheritSubBeadTypeFromBeadType?: boolean;
  beadOverride?: Partial<StrandRenderProfile> | null;
  /** When true (default), bead inherits sub bead type tier. */
  inheritBeadFromSubBeadType?: boolean;
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

/**
 * Resolve strand rendering config:
 * system → bead type → sub bead type → bead override.
 * Renderer consumes only the returned profile fields; provenance is for admin UI.
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

  return { ...profile, provenance };
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
      return "Custom override";
    case "subBeadType":
      return "Sub bead type";
    case "beadType":
      return "Bead type";
    case "system":
    default:
      return "System default";
  }
}
