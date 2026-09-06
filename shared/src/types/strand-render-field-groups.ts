import type { StrandRenderProfileKey } from "./strand-render-config.js";
import { parseStrandRenderProfile, type StrandRenderProfile } from "./strand-render-profile.js";

/** Admin UI groups — one toggle per control cluster. */
export type StrandRenderFieldGroup =
  | "visualScale"
  | "strandOccupancy"
  | "verticalOffset"
  | "orientationMode"
  | "layoutMode"
  | "layoutScale"
  | "leadingOverlap"
  | "trailingOverlap"
  | "anchorPreset"
  | "hangOffset"
  | "balanceSpacing";

export const STRAND_RENDER_FIELD_GROUPS = [
  "visualScale",
  "strandOccupancy",
  "verticalOffset",
  "orientationMode",
  "layoutMode",
  "layoutScale",
  "leadingOverlap",
  "trailingOverlap",
  "anchorPreset",
  "hangOffset",
  "balanceSpacing",
] as const satisfies readonly StrandRenderFieldGroup[];

export const STRAND_FIELD_GROUP_PROFILE_KEYS: Record<
  StrandRenderFieldGroup,
  readonly StrandRenderProfileKey[]
> = {
  visualScale: ["visualScale"],
  strandOccupancy: ["strandOccupancy", "contactWidth", "contactOffset", "spacingAdjustment"],
  verticalOffset: ["verticalOffset"],
  orientationMode: ["orientationMode", "mirrorTowardNeighbour"],
  layoutMode: [
    "layoutMode",
    "anchorPreset",
    "anchorX",
    "anchorY",
    "rotationMode",
    "forceRoundFootprint",
    "hangOffset",
  ],
  layoutScale: ["layoutScale"],
  leadingOverlap: ["leadingOverlap"],
  trailingOverlap: ["trailingOverlap"],
  anchorPreset: ["anchorPreset", "anchorX", "anchorY"],
  hangOffset: ["hangOffset"],
  balanceSpacing: ["balanceSpacing"],
};

export interface StrandRenderPartialMetadata {
  strandRenderCustomizedFields?: StrandRenderFieldGroup[];
  strandRenderOverride?: Partial<StrandRenderProfile>;
  /** @deprecated Migrated to strandRenderCustomizedFields. */
  useTypeStrandDefaults?: boolean;
  /** @deprecated Migrated to strandRenderCustomizedFields. */
  useBeadTypeStrandDefaults?: boolean;
  /** @deprecated Migrated to visualScale group. */
  customizeRenderSize?: boolean;
}

function isFieldGroup(value: unknown): value is StrandRenderFieldGroup {
  return (
    typeof value === "string" &&
    (STRAND_RENDER_FIELD_GROUPS as readonly string[]).includes(value)
  );
}

/** Read customized field groups from metadata (includes legacy migration). */
export function strandRenderCustomizedFields(
  metadata: Record<string, unknown> | null | undefined,
): StrandRenderFieldGroup[] {
  if (!metadata || typeof metadata !== "object") return [];
  const meta = metadata as StrandRenderPartialMetadata & Record<string, unknown>;
  const raw = meta.strandRenderCustomizedFields;
  if (Array.isArray(raw)) {
    return raw.filter(isFieldGroup);
  }
  if (meta.customizeRenderSize === true) {
    return ["visualScale"];
  }
  const inheritFlag =
    meta.useTypeStrandDefaults ?? meta.useBeadTypeStrandDefaults;
  if (inheritFlag === false) {
    const override = parseStrandRenderProfile(meta.strandRenderOverride) ?? {};
    const groups = new Set<StrandRenderFieldGroup>();
    for (const group of STRAND_RENDER_FIELD_GROUPS) {
      for (const key of STRAND_FIELD_GROUP_PROFILE_KEYS[group]) {
        if (override[key] !== undefined) {
          groups.add(group);
          break;
        }
      }
    }
    return [...groups];
  }
  return [];
}

export function isStrandFieldGroupCustomized(
  metadata: Record<string, unknown> | null | undefined,
  group: StrandRenderFieldGroup,
): boolean {
  return strandRenderCustomizedFields(metadata).includes(group);
}

export function strandRenderHasCustomFields(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return strandRenderCustomizedFields(metadata).length > 0;
}

/** Partial override blob for resolve — only keys belonging to customized groups. */
export function partialStrandOverrideFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Partial<StrandRenderProfile> | null {
  const groups = strandRenderCustomizedFields(metadata);
  if (!groups.length) return null;
  const raw = parseStrandRenderProfile(
    (metadata as StrandRenderPartialMetadata | undefined)?.strandRenderOverride,
  );
  if (!raw) return null;
  const partial: Partial<StrandRenderProfile> = {};
  for (const group of groups) {
    for (const key of STRAND_FIELD_GROUP_PROFILE_KEYS[group]) {
      if (raw[key] !== undefined) {
        (partial as Record<string, unknown>)[key] = raw[key];
      }
    }
  }
  return Object.keys(partial).length ? partial : null;
}

export function profileKeysForGroups(
  groups: Iterable<StrandRenderFieldGroup>,
): StrandRenderProfileKey[] {
  const keys = new Set<StrandRenderProfileKey>();
  for (const group of groups) {
    for (const key of STRAND_FIELD_GROUP_PROFILE_KEYS[group]) {
      keys.add(key);
    }
  }
  return [...keys];
}

export function pickProfileGroups(
  profile: StrandRenderProfile,
  groups: Iterable<StrandRenderFieldGroup>,
): Partial<StrandRenderProfile> {
  const partial: Partial<StrandRenderProfile> = {};
  for (const group of groups) {
    for (const key of STRAND_FIELD_GROUP_PROFILE_KEYS[group]) {
      (partial as Record<string, unknown>)[key] = profile[key];
    }
  }
  return partial;
}

export function removeGroupsFromOverride(
  override: Partial<StrandRenderProfile> | null | undefined,
  groups: Iterable<StrandRenderFieldGroup>,
): Partial<StrandRenderProfile> {
  const next = { ...(override ?? {}) } as Partial<StrandRenderProfile>;
  for (const group of groups) {
    for (const key of STRAND_FIELD_GROUP_PROFILE_KEYS[group]) {
      delete (next as Record<string, unknown>)[key];
    }
  }
  return next;
}
