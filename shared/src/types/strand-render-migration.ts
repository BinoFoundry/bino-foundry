import {
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  STRAND_RENDER_PRESETS,
  strandRenderStorageMeta,
  type StrandRenderProfile,
} from "./strand-render-profile.js";
import { STRAND_RENDER_PROFILE_KEYS, type StrandRenderProfileKey } from "./strand-render-config.js";

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
    zPriority: 5,
  },
  connector: STRAND_RENDER_PRESETS.connector ?? {},
};

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

export interface BeadLibraryStrandMetadata {
  useTypeStrandDefaults?: boolean;
  strandRenderOverride?: Partial<StrandRenderProfile>;
}

/** Normalize library metadata — drop empty overrides; honor explicit inherit opt-out. */
export function normalizeBeadLibraryStrandMetadata(
  metadata: Record<string, unknown> | null | undefined,
  inherited: StrandRenderProfile,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  const rawOverride = parseStrandRenderProfile(base.strandRenderOverride);
  const explicitOptOut = base.useTypeStrandDefaults === false;

  // Custom mode: keep authored override fields (including values that match parent)
  // so unticking "Use Parent Calibration" persists after save/reload.
  if (explicitOptOut) {
    if (rawOverride && !strandRenderOverrideIsEmpty(rawOverride)) {
      base.strandRenderOverride = rawOverride;
    } else {
      delete base.strandRenderOverride;
    }
    base.useTypeStrandDefaults = false;
    return base;
  }

  const pruned = pruneStrandRenderOverride(rawOverride, inherited);
  if (strandRenderOverrideIsEmpty(pruned)) {
    delete base.strandRenderOverride;
    base.useTypeStrandDefaults = true;
    return base;
  }

  base.strandRenderOverride = pruned;
  base.useTypeStrandDefaults = false;
  return base;
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
  if (!metadata || typeof metadata !== "object") return true;
  const meta = metadata as BeadLibraryStrandMetadata & Record<string, unknown>;
  // Explicit false must win — never treat it as inherit via empty-override fallback.
  if (meta.useTypeStrandDefaults === false) return false;
  if (meta.useTypeStrandDefaults === true) return true;
  if (meta.strandRenderOverride == null) return true;
  return strandRenderOverrideIsEmpty(parseStrandRenderProfile(meta.strandRenderOverride));
}

export interface SubBeadTypeStrandMetadata {
  useBeadTypeStrandDefaults?: boolean;
  strandRenderOverride?: Partial<StrandRenderProfile>;
}

export function subBeadTypeInheritsBeadTypeStrandDefaults(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== "object") return true;
  const meta = metadata as SubBeadTypeStrandMetadata & Record<string, unknown>;
  // Explicit false must win — empty override alone must not force inherit back on.
  if (meta.useBeadTypeStrandDefaults === false) return false;
  if (meta.useBeadTypeStrandDefaults === true) return true;
  if (meta.strandRenderOverride == null) return true;
  return strandRenderOverrideIsEmpty(parseStrandRenderProfile(meta.strandRenderOverride));
}

/** Normalize sub-type metadata — drop empty overrides; honor explicit inherit opt-out. */
export function normalizeSubBeadTypeStrandMetadata(
  metadata: Record<string, unknown> | null | undefined,
  inherited: StrandRenderProfile,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  const rawOverride = parseStrandRenderProfile(base.strandRenderOverride);
  const explicitOptOut = base.useBeadTypeStrandDefaults === false;

  // Custom mode: keep authored override fields (including values that match parent)
  // so Orientation / Anchor / etc. persist after save/reload.
  if (explicitOptOut) {
    if (rawOverride && !strandRenderOverrideIsEmpty(rawOverride)) {
      base.strandRenderOverride = { ...rawOverride, ...strandRenderStorageMeta() };
    } else {
      delete base.strandRenderOverride;
    }
    base.useBeadTypeStrandDefaults = false;
    return base;
  }

  const pruned = pruneStrandRenderOverride(rawOverride, inherited);
  if (strandRenderOverrideIsEmpty(pruned)) {
    delete base.strandRenderOverride;
    base.useBeadTypeStrandDefaults = true;
    return base;
  }

  base.strandRenderOverride = pruned;
  base.useBeadTypeStrandDefaults = false;
  return base;
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
      const override = meta.strandRenderOverride ?? null;
      const inherit = meta.useBeadTypeStrandDefaults ?? null;
      return `${sub.id}:${inherit}:${JSON.stringify(override)}`;
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
      const override = meta.strandRenderOverride ?? null;
      const inherit = meta.useTypeStrandDefaults ?? null;
      return `${lib.id}:${inherit}:${JSON.stringify(override)}`;
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
