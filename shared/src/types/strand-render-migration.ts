import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  STRAND_RENDER_PRESETS,
  strandRenderStorageMeta,
  type StrandRenderProfile,
} from "./strand-render-profile.js";
import {
  STRAND_RENDER_PROFILE_KEYS,
  type StrandRenderProfileKey,
} from "./strand-render-config.js";
import {
  partialStrandOverrideFromMetadata,
  pickProfileGroups,
  profileKeysForGroups,
  removeGroupsFromOverride,
  isStrandFieldGroupCustomized,
  strandRenderCustomizedFields,
  strandRenderHasCustomFields,
  type StrandRenderFieldGroup,
  type StrandRenderPartialMetadata,
} from "./strand-render-field-groups.js";

/** Behaviour presets — not tied to business category slugs. */
export type StrandRenderBehaviorPreset =
  | "round-bead"
  | "spacer"
  | "hanging-item"
  | "decorative-item"
  | "connector";

export const STRAND_RENDER_BEHAVIOR_PRESETS: Record<
  StrandRenderBehaviorPreset,
  Partial<StrandRenderProfile>
> = {
  "round-bead": STRAND_RENDER_PRESETS.crystal ?? {},
  spacer: STRAND_RENDER_PRESETS.spacer ?? {},
  "hanging-item": STRAND_RENDER_PRESETS.charm ?? {},
  "decorative-item": {
    ...(STRAND_RENDER_PRESETS.charm ?? {}),
  },
  connector: STRAND_RENDER_PRESETS.connector ?? {},
};

/**
 * Recommended sub-type baselines (slug → partial).
 * Used only when initializing missing configs or replacing known experimental fingerprints.
 * Never applied blindly over carefully tuned sub-type overrides.
 */
export const STRAND_RENDER_SUBTYPE_RECOMMENDED: Record<string, Partial<StrandRenderProfile>> = {
  // Round beads sitting on the cord — match crystal type (prefer inherit when possible).
  "crystal-general": {
    layoutScale: 1,
    balanceSpacing: true,
    visualScale: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: true,
  },
  // Classic hanging charms — hanging ring (loop), slight pull onto the cord.
  dangling: {
    layoutScale: 1,
    balanceSpacing: true,
    visualScale: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "dangling",
    // Loop attach on the mm box — leave Vertical at 0 for a usable out-of-box hang.
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "loop",
    orientationMode: "outward",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
  },
  hanging: {
    layoutScale: 1,
    balanceSpacing: true,
    visualScale: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "dangling",
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "loop",
    orientationMode: "outward",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
  },
  drop: {
    layoutScale: 1,
    balanceSpacing: true,
    visualScale: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "dangling",
    // Slightly lower than Dangling — same hang style, different height only.
    verticalOffset: 12,
    hangOffset: 0,
    anchorPreset: "loop",
    orientationMode: "outward",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
  },
  // Fixed ornaments sit on the strand (not hang). Customs consistently use center / 0.
  fixed: {
    layoutScale: 1,
    balanceSpacing: true,
    visualScale: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: false,
    strandOccupancy: 1,
  },
};

/** Detect experimental / non-viable sub-type baselines that block usable out-of-box render. */
export function isExperimentalSubTypeStrandBaseline(
  slug: string,
  override: Partial<StrandRenderProfile> | null | undefined,
): boolean {
  if (!override) return false;
  const s = slug.trim().toLowerCase();
  if (s === "crystal-general") {
    return override.layoutScale === 0.4 && override.contactWidth === 1.8;
  }
  if (s === "fixed") {
    return override.visualScale === 5 && override.layoutScale === 0.2;
  }
  if (s === "hanging") {
    const keys = Object.keys(override).filter((k) => k !== "verticalOffsetUnit");
    if (override.contactWidth === -0.5 && keys.length <= 2) return true;
    // Old recommended −25 fights mm-square hang; treat as stale baseline.
    return override.layoutMode === "dangling" && override.verticalOffset === -25;
  }
  if (s === "dangling") {
    return override.layoutMode === "dangling" && override.verticalOffset === -25;
  }
  if (s === "drop") {
    if (override.anchorPreset === "center" && override.layoutScale === 0.8) return true;
    // Old recommended 15 → now 12 for a gentler lower hang.
    return override.layoutMode === "dangling" && override.verticalOffset === 15;
  }
  return false;
}

export function recommendedSubTypeStrandBaseline(
  slug: string,
): Partial<StrandRenderProfile> | null {
  return STRAND_RENDER_SUBTYPE_RECOMMENDED[slug.trim().toLowerCase()] ?? null;
}

/**
 * Client-facing copy for Charm hang-related sub-types.
 * Slugs stay stable (catalogue data); names/descriptions clarify height difference.
 * Dangling and Drop both use layoutMode "dangling" — only vertical placement differs.
 */
export interface StrandSubTypeClientCopy {
  /** Display name to use when the catalogue still has the short default name. */
  suggestedName: string;
  /** Short default names we may replace (case-insensitive). */
  replaceableNames: readonly string[];
  /** Description / form hint. */
  description: string;
}

export const STRAND_SUBTYPE_CLIENT_COPY: Record<string, StrandSubTypeClientCopy> = {
  dangling: {
    suggestedName: "Dangling (on cord)",
    replaceableNames: ["Dangling"],
    description: "Hanging ring sits on the cord (higher hang).",
  },
  hanging: {
    suggestedName: "Hanging (on cord)",
    replaceableNames: ["Hanging"],
    description: "Hanging ring sits on the cord (higher hang). Same hang style as Dangling.",
  },
  drop: {
    suggestedName: "Drop (lower hang)",
    replaceableNames: ["Drop"],
    description: "Same hang style as Dangling, sits lower under the cord.",
  },
  fixed: {
    suggestedName: "Fixed (on strand)",
    replaceableNames: ["Fixed"],
    description: "Sits on the strand (does not hang).",
  },
};

export function strandSubTypeClientCopy(
  slug: string | null | undefined,
): StrandSubTypeClientCopy | null {
  if (!slug?.trim()) return null;
  return STRAND_SUBTYPE_CLIENT_COPY[slug.trim().toLowerCase()] ?? null;
}

/**
 * Hint under Sub-type select: prefer catalogue description when meaningful,
 * else built-in copy for known hang slugs.
 */
export function resolveSubBeadTypeClientHint(input: {
  slug?: string | null;
  description?: string | null;
}): string | null {
  const catalogue = input.description?.trim() ?? "";
  if (catalogue.length > 0) return catalogue;
  return strandSubTypeClientCopy(input.slug)?.description ?? null;
}

/**
 * Whether a catalogue name is still the short default we may enrich.
 * Custom client renames are left untouched.
 */
export function isReplaceableSubBeadTypeName(
  slug: string | null | undefined,
  name: string | null | undefined,
): boolean {
  const copy = strandSubTypeClientCopy(slug);
  if (!copy || !name?.trim()) return false;
  const n = name.trim().toLowerCase();
  return copy.replaceableNames.some((r) => r.toLowerCase() === n);
}

const SLUG_BEHAVIOR_PRESET: Record<string, StrandRenderBehaviorPreset> = {
  crystal: "round-bead",
  gemstone: "round-bead",
  accent: "round-bead",
  "round-bead": "round-bead",
  bead: "round-bead",
  stone: "round-bead",
  spacer: "spacer",
  separator: "spacer",
  connector: "connector",
  charm: "hanging-item",
  pendant: "hanging-item",
  locket: "hanging-item",
  "bead-cap": "decorative-item",
  cap: "decorative-item",
};

const HANGING_KEYWORDS = /\b(charm|pendant|locket|drop|dangle|hanging|bail)\b/i;
const SPACER_KEYWORDS = /\b(spacer|separator|rondelle|heishi|disc)\b/i;
const CONNECTOR_KEYWORDS = /\b(connector|finding|clasp|link|jump)\b/i;
const ROUND_KEYWORDS = /\b(crystal|bead|stone|gem|round|pearl|faceted)\b/i;

export interface StrandRenderTypeSignals {
  slug?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
}

export function beadTypeHasStrandRender(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const raw = metadata.strandRender;
  if (raw == null) return false;
  const parsed = parseStrandRenderProfile(raw);
  return parsed != null && Object.keys(parsed).length > 0;
}

function legacyRenderShape(metadata: Record<string, unknown> | null | undefined): string | null {
  const renderDefaults = metadata?.renderDefaults;
  if (!renderDefaults || typeof renderDefaults !== "object") return null;
  const shape = (renderDefaults as { shape?: unknown }).shape;
  return typeof shape === "string" ? shape.toLowerCase() : null;
}

/** Pick the closest behaviour preset for a bead type (fallback: round-bead). */
export function inferStrandRenderBehaviorPreset(signals: StrandRenderTypeSignals): StrandRenderBehaviorPreset {
  const slug = signals.slug?.trim().toLowerCase() ?? "";
  const name = signals.name?.trim() ?? "";
  const description = signals.description?.trim() ?? "";
  const haystack = `${slug} ${name} ${description}`;

  if (slug && SLUG_BEHAVIOR_PRESET[slug]) {
    return SLUG_BEHAVIOR_PRESET[slug]!;
  }

  const legacyShape = legacyRenderShape(signals.metadata ?? null);
  if (legacyShape === "rect") return "hanging-item";
  if (legacyShape === "circle") return "round-bead";

  for (const [knownSlug, preset] of Object.entries(SLUG_BEHAVIOR_PRESET)) {
    if (slug.includes(knownSlug) || name.toLowerCase().includes(knownSlug)) {
      return preset;
    }
  }

  if (HANGING_KEYWORDS.test(haystack)) return "hanging-item";
  if (SPACER_KEYWORDS.test(haystack)) return "spacer";
  if (CONNECTOR_KEYWORDS.test(haystack)) return "connector";
  if (ROUND_KEYWORDS.test(haystack)) return "round-bead";

  return "round-bead";
}

export function strandRenderDefaultsForBehaviorPreset(
  preset: StrandRenderBehaviorPreset,
): StrandRenderProfile {
  return mergeStrandRenderProfile(STRAND_RENDER_BEHAVIOR_PRESETS[preset]);
}

export function inferStrandRenderDefaultsForType(
  signals: StrandRenderTypeSignals,
): StrandRenderProfile {
  const preset = inferStrandRenderBehaviorPreset(signals);
  return strandRenderDefaultsForBehaviorPreset(preset);
}

/** Resolved type-tier profile for diffing bead overrides. */
export function resolvedTypeStrandProfile(
  typeDefaults: Partial<StrandRenderProfile> | null | undefined,
  systemDefaults?: Partial<StrandRenderProfile> | null,
): StrandRenderProfile {
  return mergeStrandRenderProfile(systemDefaults, typeDefaults);
}

/** Keep only override keys that differ from inherited type (+ system) values. */
export function pruneStrandRenderOverride(
  override: Partial<StrandRenderProfile> | null | undefined,
  inherited: StrandRenderProfile,
): Partial<StrandRenderProfile> {
  if (!override) return {};
  const pruned: Partial<StrandRenderProfile> = {};
  for (const key of STRAND_RENDER_PROFILE_KEYS) {
    // Owned by bead_types.placement_mode column — never bake into JSON overrides.
    if (key === "placementMode") continue;
    const value = override[key];
    if (value === undefined) continue;
    if (value !== inherited[key]) {
      (pruned as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(pruned).length === 0) return {};
  return { ...pruned, ...strandRenderStorageMeta() } as Partial<StrandRenderProfile>;
}

export function strandRenderOverrideIsEmpty(
  override: Partial<StrandRenderProfile> | null | undefined,
): boolean {
  if (!override) return true;
  return STRAND_RENDER_PROFILE_KEYS.every(
    (key) => key === "placementMode" || override[key] === undefined,
  );
}

export interface BeadLibraryStrandMetadata extends StrandRenderPartialMetadata {
  useTypeStrandDefaults?: boolean;
  customizeRenderSize?: boolean;
  strandRenderOverride?: Partial<StrandRenderProfile>;
}

function stripLegacyStrandFlags(base: Record<string, unknown>): void {
  delete base.imageSizeAdjust;
  delete base.customizeRenderSize;
  delete base.useTypeStrandDefaults;
  delete base.useBeadTypeStrandDefaults;
}

function normalizePartialStrandMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  stripLegacyStrandFlags(base);
  const groups = strandRenderCustomizedFields(metadata);
  if (!groups.length) {
    delete base.strandRenderOverride;
    delete base.strandRenderCustomizedFields;
    return base;
  }
  const raw = parseStrandRenderProfile(base.strandRenderOverride) ?? {};
  const keys = profileKeysForGroups(groups);
  const override: Partial<StrandRenderProfile> = {};
  for (const key of keys) {
    if (raw[key] !== undefined) {
      (override as Record<string, unknown>)[key] = raw[key];
    }
  }
  if (Object.keys(override).length === 0) {
    delete base.strandRenderOverride;
    delete base.strandRenderCustomizedFields;
    return base;
  }
  base.strandRenderCustomizedFields = groups;
  base.strandRenderOverride = { ...override, ...strandRenderStorageMeta() };
  return base;
}

/** @deprecated Use strandRenderHasCustomFields. */
export function strandCustomizeRenderSizeEnabled(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return isStrandFieldGroupCustomized(metadata, "visualScale");
}

/** @deprecated Use partialStrandOverrideFromMetadata. */
export function strandRenderSizeOnlyOverride(
  metadata: Record<string, unknown> | null | undefined,
): number | null {
  const partial = partialStrandOverrideFromMetadata(metadata);
  const visualScale = partial?.visualScale;
  return typeof visualScale === "number" && Number.isFinite(visualScale) ? visualScale : null;
}

export function setStrandFieldGroupCustomized(
  metadata: Record<string, unknown> | null | undefined,
  group: StrandRenderFieldGroup,
  enabled: boolean,
  seedProfile: StrandRenderProfile,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  let groups = strandRenderCustomizedFields(base);
  let override = {
    ...(parseStrandRenderProfile(base.strandRenderOverride) ?? {}),
  } as Partial<StrandRenderProfile>;

  if (enabled) {
    if (!groups.includes(group)) groups = [...groups, group];
    override = { ...override, ...pickProfileGroups(seedProfile, [group]) };
  } else {
    groups = groups.filter((g) => g !== group);
    override = removeGroupsFromOverride(override, [group]);
  }

  if (!groups.length) {
    delete base.strandRenderOverride;
    delete base.strandRenderCustomizedFields;
  } else {
    base.strandRenderCustomizedFields = groups;
    base.strandRenderOverride = { ...override, ...strandRenderStorageMeta() };
  }
  stripLegacyStrandFlags(base);
  return base;
}

export function patchStrandCustomizedFields(
  metadata: Record<string, unknown> | null | undefined,
  patch: Partial<StrandRenderProfile>,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  const groups = strandRenderCustomizedFields(base);
  if (!groups.length) return base;
  const current = parseStrandRenderProfile(base.strandRenderOverride) ?? {};
  const allowed = new Set(profileKeysForGroups(groups));
  const next = { ...current } as Partial<StrandRenderProfile>;
  for (const [key, value] of Object.entries(patch) as [StrandRenderProfileKey, unknown][]) {
    if (allowed.has(key)) {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  base.strandRenderOverride = { ...next, ...strandRenderStorageMeta() };
  base.strandRenderCustomizedFields = groups;
  stripLegacyStrandFlags(base);
  return base;
}

export { strandRenderHasCustomFields, strandRenderCustomizedFields, partialStrandOverrideFromMetadata };
export type { StrandRenderFieldGroup };

/** Normalize library metadata — keep only per-field customized overrides. */
export function normalizeBeadLibraryStrandMetadata(
  metadata: Record<string, unknown> | null | undefined,
  _inherited: StrandRenderProfile,
): Record<string, unknown> {
  return normalizePartialStrandMetadata(metadata);
}

export function mergeLazyStrandRenderOverride(
  currentOverride: Partial<StrandRenderProfile> | null | undefined,
  patch: Partial<StrandRenderProfile>,
  inherited: StrandRenderProfile,
): Partial<StrandRenderProfile> {
  const merged: Partial<StrandRenderProfile> = { ...(currentOverride ?? {}), ...patch };
  return pruneStrandRenderOverride(merged, inherited);
}

export function beadLibraryInheritsTypeStrandDefaults(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return !strandRenderHasCustomFields(metadata);
}

export interface SubBeadTypeStrandMetadata extends StrandRenderPartialMetadata {
  useBeadTypeStrandDefaults?: boolean;
  customizeRenderSize?: boolean;
  strandRenderOverride?: Partial<StrandRenderProfile>;
}

export function subBeadTypeInheritsBeadTypeStrandDefaults(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return !strandRenderHasCustomFields(metadata);
}

/** Normalize sub-type metadata — keep only per-field customized overrides. */
export function normalizeSubBeadTypeStrandMetadata(
  metadata: Record<string, unknown> | null | undefined,
  _inherited: StrandRenderProfile,
): Record<string, unknown> {
  return normalizePartialStrandMetadata(metadata);
}

/** Resolved sub-type tier profile for diffing bead overrides. */
export function resolvedSubBeadTypeStrandProfile(
  subTypeDefaults: Partial<StrandRenderProfile> | null | undefined,
  beadTypeDefaults?: Partial<StrandRenderProfile> | null,
  systemDefaults?: Partial<StrandRenderProfile> | null,
): StrandRenderProfile {
  return mergeStrandRenderProfile(systemDefaults, beadTypeDefaults, subTypeDefaults);
}

/** Stamp for cache invalidation when sub-type override metadata changes. */
export function subBeadTypesStrandRenderStamp(
  subTypes: Array<{ id: string; metadata?: Record<string, unknown> | null }>,
): string {
  return subTypes
    .map((sub) => {
      const meta = sub.metadata ?? {};
      const fields = JSON.stringify(meta.strandRenderCustomizedFields ?? []);
      const override = meta.strandRenderOverride ?? null;
      return `${sub.id}:${fields}:${JSON.stringify(override)}`;
    })
    .join("|");
}

/** Stamp for cache invalidation when library override metadata changes. */
export function beadLibrariesStrandRenderStamp(
  libraries: Array<{ id: string; metadata?: Record<string, unknown> | null }>,
): string {
  return libraries
    .map((lib) => {
      const meta = lib.metadata ?? {};
      const fields = JSON.stringify(meta.strandRenderCustomizedFields ?? []);
      const override = meta.strandRenderOverride ?? null;
      return `${lib.id}:${fields}:${JSON.stringify(override)}`;
    })
    .join("|");
}

export function typeNeedsStrandRenderInitialization(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return !beadTypeHasStrandRender(metadata);
}

export function buildInitializedBeadTypeMetadata(
  signals: StrandRenderTypeSignals,
  existingMetadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  const metadata = { ...(existingMetadata ?? {}) };
  if (!beadTypeHasStrandRender(metadata)) {
    metadata.strandRender = inferStrandRenderDefaultsForType({
      ...signals,
      metadata,
    });
  }
  return metadata;
}

export { DEFAULT_STRAND_RENDER_PROFILE };
