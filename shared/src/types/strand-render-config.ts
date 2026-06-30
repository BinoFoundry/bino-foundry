import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  type StrandRenderProfile,
} from "./strand-render-profile.js";

/** `config_kv` key for platform-wide strand rendering defaults. */
export const STRAND_RENDER_SYSTEM_DEFAULTS_KEY = "bracelet.strand_render_defaults_v1";

export type StrandRenderConfigSource = "system" | "beadType" | "beadOverride";

export type StrandRenderProfileKey = keyof StrandRenderProfile;

export interface ResolvedStrandRenderConfig extends StrandRenderProfile {
  /** Which hierarchy level supplied each property (for admin display). */
  provenance: Record<StrandRenderProfileKey, StrandRenderConfigSource>;
}

export const STRAND_RENDER_PROFILE_KEYS = [
  "attachmentStyle",
  "strandOccupancy",
  "anchorPreset",
  "anchorX",
  "anchorY",
  "verticalOffset",
  "visualScale",
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
  beadOverride?: Partial<StrandRenderProfile> | null;
  /** When true, bead-level overrides are ignored (inherit bead type). */
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

/**
 * Resolve strand rendering config: bead override → bead type → system → code default.
 * Renderer consumes only the returned profile fields; provenance is for admin UI.
 */
export function resolveStrandRenderConfig(layers: StrandRenderConfigLayers): ResolvedStrandRenderConfig {
  const provenance = Object.fromEntries(
    STRAND_RENDER_PROFILE_KEYS.map((key) => [key, "system" as StrandRenderConfigSource]),
  ) as Record<StrandRenderProfileKey, StrandRenderConfigSource>;

  let profile = { ...DEFAULT_STRAND_RENDER_PROFILE };
  profile = applyLayer(profile, layers.systemDefaults, "system", provenance);
  profile = applyLayer(profile, layers.beadTypeDefaults, "beadType", provenance);

  const inheritType = layers.inheritTypeDefaults !== false;
  if (!inheritType) {
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
    case "beadType":
      return "Bead type";
    case "system":
    default:
      return "System default";
  }
}
