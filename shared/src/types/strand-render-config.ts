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
   * @deprecated Always 1 — legacy imageSizeAdjust removed; use visualScale only.
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
  "mirrorTowardNeighbour",
  "preferStrandImageUrl",
  "placementMode",
] as const satisfies readonly StrandRenderProfileKey[];

export interface StrandRenderConfigLayers {
  systemDefaults?: Partial<StrandRenderProfile> | null;
  beadTypeDefaults?: Partial<StrandRenderProfile> | null;
  /** Partial per-field overrides from sub-type metadata. */
  subBeadTypePartialOverride?: Partial<StrandRenderProfile> | null;
  /** Partial per-field overrides from bead library metadata. */
  beadPartialOverride?: Partial<StrandRenderProfile> | null;
  /**
   * @deprecated Legacy full override — use subBeadTypePartialOverride.
   */
  subBeadTypeOverride?: Partial<StrandRenderProfile> | null;
  /** @deprecated Legacy full override — use beadPartialOverride. */
  beadOverride?: Partial<StrandRenderProfile> | null;
  /** @deprecated Ignored — partial overrides replace inherit flags. */
  inheritSubBeadTypeFromBeadType?: boolean;
  /** @deprecated Ignored — partial overrides replace inherit flags. */
  inheritBeadFromSubBeadType?: boolean;
  /** @deprecated Ignored — partial overrides replace inherit flags. */
  inheritTypeDefaults?: boolean;
  /** @deprecated Use beadPartialOverride. */
  beadRenderSizeOnly?: Partial<Pick<StrandRenderProfile, "visualScale">> | null;
  /** @deprecated Use subBeadTypePartialOverride. */
  subBeadTypeRenderSizeOnly?: Partial<Pick<StrandRenderProfile, "visualScale">> | null;
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

function coalescePartial(
  primary: Partial<StrandRenderProfile> | null | undefined,
  legacyFull: Partial<StrandRenderProfile> | null | undefined,
  legacySizeOnly: Partial<Pick<StrandRenderProfile, "visualScale">> | null | undefined,
): Partial<StrandRenderProfile> | null {
  if (primary && explicitKeys(primary).length > 0) return primary;
  if (legacySizeOnly?.visualScale != null) return { visualScale: legacySizeOnly.visualScale };
  if (legacyFull && explicitKeys(legacyFull).length > 0) return legacyFull;
  return null;
}

/**
 * Resolve strand rendering config:
 * system → bead type → sub-type partial → bead partial.
 * Un customized fields inherit from the parent tier automatically.
 */
export function resolveStrandRenderConfig(layers: StrandRenderConfigLayers): ResolvedStrandRenderConfig {
  const provenance = Object.fromEntries(
    STRAND_RENDER_PROFILE_KEYS.map((key) => [key, "system" as StrandRenderConfigSource]),
  ) as Record<StrandRenderProfileKey, StrandRenderConfigSource>;

  let profile = { ...DEFAULT_STRAND_RENDER_PROFILE };
  profile = applyLayer(profile, layers.systemDefaults, "system", provenance);
  profile = applyLayer(profile, layers.beadTypeDefaults, "beadType", provenance);

  const subPartial = coalescePartial(
    layers.subBeadTypePartialOverride,
    layers.inheritSubBeadTypeFromBeadType === false ? layers.subBeadTypeOverride : null,
    layers.subBeadTypeRenderSizeOnly,
  );
  profile = applyLayer(profile, subPartial, "subBeadType", provenance);

  const beadPartial = coalescePartial(
    layers.beadPartialOverride,
    layers.inheritBeadFromSubBeadType === false || layers.inheritTypeDefaults === false
      ? layers.beadOverride
      : null,
    layers.beadRenderSizeOnly,
  );
  profile = applyLayer(profile, beadPartial, "beadOverride", provenance);

  return { ...profile, provenance, resolvedRenderScale: profile.visualScale, imageSizeAdjust: 1 };
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
      return "Custom";
    case "subBeadType":
      return "Custom";
    case "beadType":
      return "From bead type";
    case "system":
    default:
      return "From system";
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
