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
 * Data-driven strand rendering behaviour for a bead type or library override.
 * The renderer reads these values only — never asset category slugs.
 */
export interface StrandRenderProfile {
  /**
   * Global contact-layout calibration applied to the measured rendered tangent diameter.
   * Positioning only: never changes bitmap/CSS size. 1 = 100%.
   */
  layoutScale: number;
  /**
   * Legacy largest-gap optical pass only. Bracelet Builder uses physical-contact packing
   * (edge-to-edge; leftover wrist length = one unfinished arc), so this does not stretch
   * gaps when the wrist size grows with a fixed bead set.
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
   * Radial offset as a fraction of slot height.
   * Negative moves toward ring centre (pulls hanging assets onto the cord).
   */
  verticalOffset: number;
  /** Visual size multiplier — independent from strand occupancy. */
  visualScale: number;
  /** Resolved facing — outward (away from centre) or inward (toward centre). */
  orientationMode: StrandOrientationMode;
  rotationMode: StrandRotationMode;
  /** Extra rotation applied after path rotation (degrees). */
  rotationOffsetDeg: number;
  zPriority: number;
  /** Extra arc padding between neighbours (px at scale 1). */
  collisionPadding: number;
  /** 0–1 — how much this asset hides the cord beneath it. */
  stringOcclusion: number;
  /** When true, layout footprint is forced square (round beads). */
  forceRoundFootprint: boolean;
  /** Prefer metadata.strandImageUrl over processed delivery URL. */
  preferStrandImageUrl: boolean;
}

/** Symmetrical stored range for contact width + adjustment (-max … +max). */
export const STRAND_CONTACT_SPACING_MAX = 2;
export const STRAND_CONTACT_SPACING_MIN = -STRAND_CONTACT_SPACING_MAX;

/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_WIDTH_MIN = STRAND_CONTACT_SPACING_MIN;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_WIDTH_MAX = STRAND_CONTACT_SPACING_MAX;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_ADJUSTMENT_MIN = STRAND_CONTACT_SPACING_MIN;
/** @deprecated Use STRAND_CONTACT_SPACING_MIN / STRAND_CONTACT_SPACING_MAX */
export const STRAND_CONTACT_ADJUSTMENT_MAX = STRAND_CONTACT_SPACING_MAX;

/** Minimum allowed value when maximum is `absMax` (always `-absMax`). */
export function strandContactSpacingMin(absMax = STRAND_CONTACT_SPACING_MAX): number {
  return -absMax;
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
  orientationMode: "outward",
  rotationMode: "tangent",
  rotationOffsetDeg: 0,
  zPriority: 0,
  collisionPadding: 0,
  stringOcclusion: 1,
  forceRoundFootprint: true,
  preferStrandImageUrl: false,
};

/** @deprecated Migration seed reference only — runtime uses DB hierarchy (system → type → bead). */
export const STRAND_RENDER_PRESETS: Record<string, Partial<StrandRenderProfile>> = {
  crystal: {
    strandOccupancy: 1,
    contactWidth: 1,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: true,
  },
  gemstone: {
    strandOccupancy: 1,
    contactWidth: 1,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: true,
  },
  accent: {
    strandOccupancy: 1,
    contactWidth: 1,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: true,
  },
  "round-bead": {
    strandOccupancy: 1,
    contactWidth: 1,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: true,
  },
  charm: {
    strandOccupancy: 1,
    layoutMode: "dangling",
    // Layout occupancy is always catalogue sizeMm (see beadOccupancyArcPx) — contactWidth
    // no longer scales the arc, so no value here can collapse a full bracelet. Dangling is
    // purely visual (loop anchor / hang).
    contactWidth: 1,
    leadingOverlap: 0.03,
    trailingOverlap: 0.03,
    anchorPreset: "loop",
    anchorX: 0.5,
    anchorY: 0.08,
    verticalOffset: 0,
    hangOffset: 0,
    visualScale: 1,
    orientationMode: "outward",
    zPriority: 10,
    forceRoundFootprint: false,
  },
  spacer: {
    strandOccupancy: 1,
    layoutMode: "inline",
    contactWidth: 1,
    leadingOverlap: 0.02,
    trailingOverlap: 0.02,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: false,
    visualScale: 1,
  },
  separator: {
    strandOccupancy: 1,
    layoutMode: "inline",
    contactWidth: 1,
    leadingOverlap: 0.02,
    trailingOverlap: 0.02,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
  },
  connector: {
    strandOccupancy: 0.45,
    contactWidth: 0.2,
    leadingOverlap: 0.04,
    trailingOverlap: 0.04,
    anchorPreset: "center",
    orientationMode: "outward",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
  },
};

function clampContactSpacingStored(value: number): number {
  return Math.max(
    STRAND_CONTACT_SPACING_MIN,
    Math.min(STRAND_CONTACT_SPACING_MAX, value),
  );
}

/**
 * Convert stored contactWidth to an additive tuning delta on natural touch (1 = neutral span).
 * Neutral is 1 (full catalogue sizeMm on the wrist ring). Values below 1 tighten;
 * values above 1 loosen. Admin tuning may also use 0 as a neutral synonym via offsets.
 */
export function contactWidthStoredToTuningDelta(stored: number): number {
  if (Math.abs(stored - 1) < 0.001) return 0;
  if (stored > 0 && stored <= 2) return stored - 1;
  return stored;
}

/**
 * Span multiplier applied to visible tangent contact (natural touch at 1.0).
 * Order: natural touch → contact width tuning → contact adjustment → spacing adjustment.
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

export function mergeStrandRenderProfile(
  ...partials: (Partial<StrandRenderProfile> | null | undefined)[]
): StrandRenderProfile {
  const merged = { ...DEFAULT_STRAND_RENDER_PROFILE };
  for (const partial of partials) {
    if (!partial) continue;
    Object.assign(merged, partial);
  }
  if (partials.some((p) => p?.anchorPreset && p.anchorX === undefined && p.anchorY === undefined)) {
    const coords = anchorCoordsForPreset(merged.anchorPreset);
    merged.anchorX = coords.anchorX;
    merged.anchorY = coords.anchorY;
  }
  merged.layoutScale = Math.max(0.9, Math.min(1.1, merged.layoutScale));
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
  merged.visualScale = Math.max(0.25, Math.min(3, merged.visualScale));
  merged.stringOcclusion = Math.max(0, Math.min(1, merged.stringOcclusion));
  return merged;
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
  if (typeof o.verticalOffset === "number") partial.verticalOffset = o.verticalOffset;
  if (typeof o.visualScale === "number") partial.visualScale = o.visualScale;
  if (o.orientationMode === "outward" || o.orientationMode === "inward") {
    partial.orientationMode = o.orientationMode;
  }
  if (typeof o.rotationMode === "string") partial.rotationMode = o.rotationMode as StrandRotationMode;
  if (typeof o.rotationOffsetDeg === "number") partial.rotationOffsetDeg = o.rotationOffsetDeg;
  if (typeof o.zPriority === "number") partial.zPriority = o.zPriority;
  if (typeof o.collisionPadding === "number") partial.collisionPadding = o.collisionPadding;
  if (typeof o.stringOcclusion === "number") partial.stringOcclusion = o.stringOcclusion;
  if (typeof o.forceRoundFootprint === "boolean") partial.forceRoundFootprint = o.forceRoundFootprint;
  if (typeof o.preferStrandImageUrl === "boolean") partial.preferStrandImageUrl = o.preferStrandImageUrl;
  return partial;
}
