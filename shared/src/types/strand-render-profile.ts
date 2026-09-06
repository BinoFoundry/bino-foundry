/** How an asset rotates as it moves around the bracelet ring. */
export type StrandRotationMode =
  | "tangent"
  | "radial-upright"
  | "fixed-upright"
  | "none";

/** Which way the bead front faces relative to the bracelet centre. */
export type StrandOrientationMode = "outward" | "inward";

/** Preset anchor presets — resolved to normalised slot coordinates. */
export type StrandAnchorPreset = "center" | "loop" | "top" | "bottom";

/** How the asset attaches to the strand layout. */
export type StrandAttachmentStyle = "inline" | "betweenItems";

/** Whether spacing uses full slot width (inline) or attachment point only (dangling). */
export type StrandLayoutMode = "inline" | "dangling";

/**
 * How a library drag interacts with existing strand beads.
 *
 * `frame` is not a strand position at all: the item attaches to whichever bead
 * it is dropped on and draws over it, like a halo around a crystal. It claims
 * no arc, so occupancy, spacing and capacity are untouched — the attachment
 * lives on `PlacedBead.frame` rather than in the bead sequence.
 */
export type BeadPlacementMode = "replace" | "insert_between" | "frame";

export const BEAD_PLACEMENT_MODES = [
  "replace",
  "insert_between",
  "frame",
] as const satisfies readonly BeadPlacementMode[];

export const DEFAULT_BEAD_PLACEMENT_MODE: BeadPlacementMode = "replace";

/** Parse/validate placement mode; invalid or missing → replace. */
export function parseBeadPlacementMode(raw: unknown): BeadPlacementMode {
  if (raw === "insert_between" || raw === "replace" || raw === "frame") return raw;
  return DEFAULT_BEAD_PLACEMENT_MODE;
}

/**
 * Data-driven strand rendering behaviour for a bead type or library override.
 * The renderer reads these values only — never asset category slugs.
 */
export interface StrandRenderProfile {
  /**
   * Contact-layout calibration multiplier. Scales positioning arcs and the matching
   * shell size together. Does not change capacity mm. 1 = measured size.
   * Allowed range: {@link STRAND_LAYOUT_SCALE_MIN}…{@link STRAND_LAYOUT_SCALE_MAX}.
   */
  layoutScale: number;
  /**
   * When true, lock Top / Bottom / Right / Left and equalise empty gaps inside each
   * quadrant segment using occupancy widths. Preserves orientation when wrist size changes.
   */
  balanceSpacing: boolean;
  /** Inline on occupied arc, or between two neighbours (connectors). */
  attachmentStyle: StrandAttachmentStyle;
  /** Fraction of tangent width occupied on the strand (1 = one bead width). @deprecated Use contactWidth */
  strandOccupancy: number;
  /**
   * Tangential contact width as a fraction of the mm slot width (1 = full bead width).
   * Layout spacing uses this — not bitmap dimensions. Slight negatives are allowed for tuning.
   */
  contactWidth: number;
  /**
   * Visual attachment style. Occupancy always follows catalogue sizeMm × contact tuning —
   * dangling only affects shell anchor / hang, never a separate angle algorithm.
   */
  layoutMode: StrandLayoutMode;
  /**
   * Fine spacing adjustment (fraction of slot width).
   * Negative pulls neighbours closer; positive adds slack.
   */
  contactOffset: number;
  /** @deprecated Prefer contactOffset — summed into effective contact width. */
  spacingAdjustment: number;
  /** Overlap with the previous neighbour along the strand (fraction of slot width). */
  leadingOverlap: number;
  /** Overlap with the next neighbour along the strand (fraction of slot width). */
  trailingOverlap: number;
  /**
   * Radial hang below the strand (fraction of shell height).
   * Positive moves away from ring centre for hanging ornaments.
   */
  hangOffset: number;
  anchorPreset: StrandAnchorPreset;
  /** Normalised anchor X in slot (0–1). Derived from preset unless overridden. */
  anchorX: number;
  /** Normalised anchor Y in slot (0–1). Derived from preset unless overridden. */
  anchorY: number;
  /**
   * Radial offset as a percent of slot height (−100…100).
   * Negative moves toward ring centre (pulls hanging assets onto the cord).
   * Stored 1:1 with the admin input (no fraction/percentage UI mapping).
   */
  verticalOffset: number;
  /**
   * Visual render calibration multiplier (1 = same as mm slot). Independent from strand occupancy.
   * Allowed range: {@link STRAND_VISUAL_SCALE_MIN}…{@link STRAND_VISUAL_SCALE_MAX}.
   */
  visualScale: number;
  /**
   * Power-curve exponent for how strongly catalogue mm differences appear visually.
   * `1` = linear physical scaling. Values below 1 compress size jumps (e.g. 6→8→10mm).
   * Anchored so the reference size ({@link STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM}) is unchanged.
   * Does not affect occupancy, contact width, or layout scale.
   * Allowed range: {@link STRAND_VISUAL_SIZE_SCALING_MIN}…{@link STRAND_VISUAL_SIZE_SCALING_MAX}.
   */
  visualSizeScaling: number;
  /** Resolved facing — outward (away from centre) or inward (toward centre). */
  orientationMode: StrandOrientationMode;
  rotationMode: StrandRotationMode;
  /** Extra rotation applied after path rotation (degrees). */
  rotationOffsetDeg: number;
  /** Extra arc padding between neighbours (px at scale 1). */
  collisionPadding: number;
  /** 0–1 — how much this asset hides the cord beneath it. */
  stringOcclusion: number;
  /** When true, layout footprint is forced square (round beads). */
  forceRoundFootprint: boolean;
  /**
   * Flip the asset horizontally so it opens toward the bead beside it.
   *
   * For pieces that are not symmetrical along the cord — a bead cap sits on
   * either side of a bead and must face it — so one uploaded image serves both
   * positions. Purely visual: the flip happens inside the slot's own rotated
   * frame and changes no geometry, spacing or capacity.
   */
  mirrorTowardNeighbour: boolean;
  /** Prefer metadata.strandImageUrl over processed delivery URL. */
  preferStrandImageUrl: boolean;
  /**
   * How library placement interacts with occupied strand slots.
   * Sourced from bead_types.placement_mode — never inferred from category names.
   */
  placementMode: BeadPlacementMode;
}

/** Layout scale — stored and edited 1:1. */
export const STRAND_LAYOUT_SCALE_MIN = 0.1;
export const STRAND_LAYOUT_SCALE_MAX = 5;
export const STRAND_LAYOUT_SCALE_STEP = 0.01;

/** Symmetrical stored range for contact width + adjustment (-max … +max). */
export const STRAND_CONTACT_SPACING_MAX = 20;
export const STRAND_CONTACT_SPACING_MIN = -STRAND_CONTACT_SPACING_MAX;
export const STRAND_CONTACT_SPACING_STEP = 0.1;

/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_WIDTH_MIN = STRAND_CONTACT_SPACING_MIN;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_WIDTH_MAX = STRAND_CONTACT_SPACING_MAX;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_ADJUSTMENT_MIN = STRAND_CONTACT_SPACING_MIN;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_ADJUSTMENT_MAX = STRAND_CONTACT_SPACING_MAX;

/** Render calibration (visualScale) — stored and edited 1:1. */
export const STRAND_VISUAL_SCALE_MIN = 0.1;
export const STRAND_VISUAL_SCALE_MAX = 5;
export const STRAND_VISUAL_SCALE_STEP = 0.01;

/**
 * Visual size scaling (power-curve exponent) — stored and edited 1:1.
 * Code / missing-field fallback is linear (`1`). System defaults may seed a softer curve.
 */
export const STRAND_VISUAL_SIZE_SCALING_MIN = 0.25;
export const STRAND_VISUAL_SIZE_SCALING_MAX = 2;
export const STRAND_VISUAL_SIZE_SCALING_STEP = 0.01;
/** Mm size whose rendered diameter stays fixed for any exponent (preserves current calibration). */
export const STRAND_VISUAL_SIZE_SCALING_ANCHOR_MM = 6;
/** Suggested system default — subtle progression between catalogue sizes. */
export const STRAND_VISUAL_SIZE_SCALING_SYSTEM_DEFAULT = 0.7;

/**
 * Vertical offset as percent of bead height (−100…100).
 * Stored 1:1 with the admin field; layout math divides by 100.
 */
export const STRAND_VERTICAL_OFFSET_MIN = -100;
export const STRAND_VERTICAL_OFFSET_MAX = 100;
export const STRAND_VERTICAL_OFFSET_STEP = 0.1;

/** Persist marker — distinguishes percent storage from legacy fraction (−1…1). */
export const STRAND_VERTICAL_OFFSET_UNIT_PERCENT = "percent" as const;

/** Minimum allowed value when maximum is `absMax` (always `-absMax`). */
export function strandContactSpacingMin(absMax = STRAND_CONTACT_SPACING_MAX): number {
  return -absMax;
}

/**
 * Convert stored vertical offset (percent of height) to a height fraction for layout math.
 */
export function verticalOffsetHeightFraction(verticalOffset: number): number {
  if (!Number.isFinite(verticalOffset)) return 0;
  return verticalOffset / 100;
}

/**
 * Coerce a persisted verticalOffset into percent units.
 * Legacy fraction values (−1…1 without a percent unit marker) are scaled ×100 once.
 */
export function coerceVerticalOffsetPercent(
  value: number,
  unit?: unknown,
): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === STRAND_VERTICAL_OFFSET_UNIT_PERCENT) return value;
  // Legacy fraction storage (pre-percent migration).
  if (value !== 0 && Math.abs(value) <= 1) return value * 100;
  return value;
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Renderer floor — legacy constant; effective contact width may reach 0 at layout time. */
export const STRAND_EFFECTIVE_CONTACT_WIDTH_MIN = 0;

export const DEFAULT_STRAND_RENDER_PROFILE: StrandRenderProfile = {
  layoutScale: 1,
  balanceSpacing: true,
  attachmentStyle: "inline",
  strandOccupancy: 1,
  contactWidth: 1,
  layoutMode: "inline",
  contactOffset: 0,
  spacingAdjustment: 0,
  leadingOverlap: 0,
  trailingOverlap: 0,
  hangOffset: 0,
  anchorPreset: "center",
  anchorX: 0.5,
  anchorY: 0.5,
  verticalOffset: 0,
  visualScale: 1,
  visualSizeScaling: 1,
  orientationMode: "outward",
  rotationMode: "tangent",
  rotationOffsetDeg: 0,
  collisionPadding: 0,
  stringOcclusion: 1,
  forceRoundFootprint: true,
  mirrorTowardNeighbour: false,
  preferStrandImageUrl: false,
  placementMode: DEFAULT_BEAD_PLACEMENT_MODE,
};

/** @deprecated Migration seed reference only — runtime uses DB hierarchy (system → type → bead). */
export const STRAND_RENDER_PRESETS: Record<string, Partial<StrandRenderProfile>> = {
  crystal: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    visualScale: 1,
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: true,
    placementMode: "replace",
  },
  gemstone: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    visualScale: 1,
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: true,
    placementMode: "replace",
  },
  accent: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    visualScale: 1,
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: true,
    placementMode: "replace",
  },
  "round-bead": {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    contactWidth: 1,
    contactOffset: 0,
    layoutMode: "inline",
    visualScale: 1,
    verticalOffset: 0,
    hangOffset: 0,
    anchorPreset: "center",
    orientationMode: "outward",
    rotationMode: "tangent",
    forceRoundFootprint: true,
    placementMode: "replace",
  },
  charm: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    layoutMode: "dangling",
    // Occupancy follows catalogue sizeMm — contactWidth stays 1. Hang is visual only.
    contactWidth: 1,
    contactOffset: 0,
    leadingOverlap: 0.03,
    trailingOverlap: 0.03,
    anchorPreset: "loop",
    anchorX: 0.5,
    anchorY: 0.08,
    // Neutral at type tier; dangling / drop sub-types refine verticalOffset.
    verticalOffset: 0,
    hangOffset: 0,
    visualScale: 1,
    orientationMode: "outward",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
    placementMode: "insert_between",
  },
  spacer: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    layoutMode: "inline",
    contactWidth: 1,
    // Slight tighten so thin spacers sit closer without collapsing capacity.
    contactOffset: -0.15,
    leadingOverlap: 0.02,
    trailingOverlap: 0.02,
    anchorPreset: "center",
    visualScale: 1,
    verticalOffset: 0,
    placementMode: "replace",
    orientationMode: "outward",
    forceRoundFootprint: false,
  },
  separator: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 1,
    layoutMode: "inline",
    contactWidth: 1,
    contactOffset: -0.15,
    leadingOverlap: 0.02,
    trailingOverlap: 0.02,
    anchorPreset: "center",
    visualScale: 1,
    verticalOffset: 0,
    orientationMode: "outward",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
    placementMode: "insert_between",
  },
  connector: {
    layoutScale: 1,
    balanceSpacing: true,
    strandOccupancy: 0.45,
    layoutMode: "inline",
    contactWidth: 0.45,
    contactOffset: 0,
    leadingOverlap: 0.04,
    trailingOverlap: 0.04,
    anchorPreset: "center",
    visualScale: 1,
    verticalOffset: 0,
    orientationMode: "outward",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
    placementMode: "insert_between",
  },
};

function clampContactSpacingStored(value: number): number {
  return clampToRange(value, STRAND_CONTACT_SPACING_MIN, STRAND_CONTACT_SPACING_MAX);
}

/**
 * Convert stored contactWidth to an additive tuning delta on natural touch (1 = neutral span).
 * Neutral is 1 (full catalogue sizeMm on the wrist ring). Values below 1 tighten;
 * values above 1 loosen. Admin tuning may also use 0 as a neutral synonym via offsets.
 */
export function contactWidthStoredToTuningDelta(stored: number): number {
  if (Math.abs(stored - 1) < 0.001) return 0;
  // Legacy fractional occupancy in (0, 2] was stored as absolute span, not a delta.
  if (stored > 0 && stored <= 2) return stored - 1;
  return stored;
}

/**
 * Span multiplier applied to visible tangent contact (natural touch at 1.0).
 * Order: natural touch → contact width tuning → contact adjustment → spacing adjustment.
 * Floored at 0 so spacing cannot invert; upper bound matches the stored contact range.
 */
export function effectiveStrandContactWidth(
  profile: Pick<StrandRenderProfile, "contactWidth" | "contactOffset" | "spacingAdjustment">,
): number {
  const widthDelta = contactWidthStoredToTuningDelta(profile.contactWidth);
  const tuning = widthDelta + profile.contactOffset + profile.spacingAdjustment;
  const span = 1 + tuning;
  return Math.max(0, Math.min(STRAND_CONTACT_SPACING_MAX, span));
}

export function anchorCoordsForPreset(preset: StrandAnchorPreset): { anchorX: number; anchorY: number } {
  switch (preset) {
    case "loop":
      return { anchorX: 0.5, anchorY: 0.08 };
    case "top":
      return { anchorX: 0.5, anchorY: 0 };
    case "bottom":
      return { anchorX: 0.5, anchorY: 1 };
    case "center":
    default:
      return { anchorX: 0.5, anchorY: 0.5 };
  }
}

/**
 * Merge profile layers. Calibration fields are clamped only to their explicit allowed
 * ranges (safety for corrupt data) — never remapped or percent-scaled.
 */
export function mergeStrandRenderProfile(
  ...partials: (Partial<StrandRenderProfile> | null | undefined)[]
): StrandRenderProfile {
  const merged = { ...DEFAULT_STRAND_RENDER_PROFILE };
  for (const partial of partials) {
    if (!partial) continue;
    Object.assign(merged, partial);
  }
  // UI only exposes presets (no freeform X/Y). Always derive coords from the final preset so
  // changing Anchor point cannot leave stale anchorY from a previous preset in the override.
  {
    const coords = anchorCoordsForPreset(merged.anchorPreset);
    merged.anchorX = coords.anchorX;
    merged.anchorY = coords.anchorY;
  }
  merged.layoutScale = clampToRange(
    merged.layoutScale,
    STRAND_LAYOUT_SCALE_MIN,
    STRAND_LAYOUT_SCALE_MAX,
  );
  merged.strandOccupancy = Math.max(0.05, Math.min(2, merged.strandOccupancy));
  merged.contactWidth = clampContactSpacingStored(merged.contactWidth);
  merged.contactOffset = clampContactSpacingStored(merged.contactOffset);
  merged.spacingAdjustment = clampContactSpacingStored(merged.spacingAdjustment);
  if (merged.layoutMode !== "inline" && merged.layoutMode !== "dangling") {
    merged.layoutMode = "inline";
  }
  merged.leadingOverlap = Math.max(0, Math.min(0.5, merged.leadingOverlap));
  merged.trailingOverlap = Math.max(0, Math.min(0.5, merged.trailingOverlap));
  merged.hangOffset = Math.max(-1, Math.min(1, merged.hangOffset));
  merged.verticalOffset = clampToRange(
    merged.verticalOffset,
    STRAND_VERTICAL_OFFSET_MIN,
    STRAND_VERTICAL_OFFSET_MAX,
  );
  merged.visualScale = clampToRange(
    merged.visualScale,
    STRAND_VISUAL_SCALE_MIN,
    STRAND_VISUAL_SCALE_MAX,
  );
  merged.visualSizeScaling = clampToRange(
    merged.visualSizeScaling,
    STRAND_VISUAL_SIZE_SCALING_MIN,
    STRAND_VISUAL_SIZE_SCALING_MAX,
  );
  merged.stringOcclusion = Math.max(0, Math.min(1, merged.stringOcclusion));
  merged.placementMode = parseBeadPlacementMode(merged.placementMode);
  return merged;
}

/**
 * Attach persistence markers so reloads keep 1:1 numeric units (no legacy remapping).
 * Spread onto JSON written to config_kv / bead metadata.
 */
export function strandRenderStorageMeta(): { verticalOffsetUnit: typeof STRAND_VERTICAL_OFFSET_UNIT_PERCENT } {
  return { verticalOffsetUnit: STRAND_VERTICAL_OFFSET_UNIT_PERCENT };
}

export function parseStrandRenderProfile(raw: unknown): Partial<StrandRenderProfile> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const partial: Partial<StrandRenderProfile> = {};
  if (typeof o.layoutScale === "number") partial.layoutScale = o.layoutScale;
  if (typeof o.balanceSpacing === "boolean") partial.balanceSpacing = o.balanceSpacing;
  if (typeof o.strandOccupancy === "number") partial.strandOccupancy = o.strandOccupancy;
  if (typeof o.contactWidth === "number") partial.contactWidth = o.contactWidth;
  if (o.layoutMode === "inline" || o.layoutMode === "dangling") {
    partial.layoutMode = o.layoutMode;
  }
  if (typeof o.contactOffset === "number") partial.contactOffset = o.contactOffset;
  if (typeof o.spacingAdjustment === "number") partial.spacingAdjustment = o.spacingAdjustment;
  if (typeof o.leadingOverlap === "number") partial.leadingOverlap = o.leadingOverlap;
  if (typeof o.trailingOverlap === "number") partial.trailingOverlap = o.trailingOverlap;
  if (typeof o.hangOffset === "number") partial.hangOffset = o.hangOffset;
  if (typeof o.attachmentStyle === "string") {
    partial.attachmentStyle = o.attachmentStyle as StrandAttachmentStyle;
  }
  if (typeof o.anchorPreset === "string") partial.anchorPreset = o.anchorPreset as StrandAnchorPreset;
  if (typeof o.anchorX === "number") partial.anchorX = o.anchorX;
  if (typeof o.anchorY === "number") partial.anchorY = o.anchorY;
  if (typeof o.verticalOffset === "number") {
    partial.verticalOffset = coerceVerticalOffsetPercent(o.verticalOffset, o.verticalOffsetUnit);
  }
  if (typeof o.visualScale === "number") partial.visualScale = o.visualScale;
  if (typeof o.visualSizeScaling === "number") partial.visualSizeScaling = o.visualSizeScaling;
  if (o.orientationMode === "outward" || o.orientationMode === "inward") {
    partial.orientationMode = o.orientationMode;
  }
  if (typeof o.rotationMode === "string") partial.rotationMode = o.rotationMode as StrandRotationMode;
  if (typeof o.rotationOffsetDeg === "number") partial.rotationOffsetDeg = o.rotationOffsetDeg;
  if (typeof o.collisionPadding === "number") partial.collisionPadding = o.collisionPadding;
  if (typeof o.stringOcclusion === "number") partial.stringOcclusion = o.stringOcclusion;
  if (typeof o.forceRoundFootprint === "boolean") partial.forceRoundFootprint = o.forceRoundFootprint;
  if (typeof o.mirrorTowardNeighbour === "boolean") partial.mirrorTowardNeighbour = o.mirrorTowardNeighbour;
  if (typeof o.preferStrandImageUrl === "boolean") partial.preferStrandImageUrl = o.preferStrandImageUrl;
  if (o.placementMode === "replace" || o.placementMode === "insert_between") {
    partial.placementMode = o.placementMode;
  }
  return partial;
}
