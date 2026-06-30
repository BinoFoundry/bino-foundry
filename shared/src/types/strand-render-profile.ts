/** How an asset rotates as it moves around the bracelet ring. */
export type StrandRotationMode =
  | "tangent"
  | "radial-upright"
  | "fixed-upright"
  | "none";

/** Preset anchor presets — resolved to normalised slot coordinates. */
export type StrandAnchorPreset = "center" | "loop" | "top" | "bottom";

/** How the asset attaches to the strand layout. */
export type StrandAttachmentStyle = "inline" | "betweenItems";

/**
 * Data-driven strand rendering behaviour for a bead type or library override.
 * The renderer reads these values only — never asset category slugs.
 */
export interface StrandRenderProfile {
  /** Inline on occupied arc, or between two neighbours (connectors). */
  attachmentStyle: StrandAttachmentStyle;
  /** Fraction of tangent width occupied on the strand (1 = one bead width). */
  strandOccupancy: number;
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

export const DEFAULT_STRAND_RENDER_PROFILE: StrandRenderProfile = {
  attachmentStyle: "inline",
  strandOccupancy: 1,
  anchorPreset: "center",
  anchorX: 0.5,
  anchorY: 0.5,
  verticalOffset: 0,
  visualScale: 1,
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
    anchorPreset: "center",
    rotationMode: "tangent",
    forceRoundFootprint: true,
  },
  gemstone: {
    strandOccupancy: 1,
    anchorPreset: "center",
    rotationMode: "tangent",
    forceRoundFootprint: true,
  },
  accent: {
    strandOccupancy: 1,
    anchorPreset: "center",
    rotationMode: "tangent",
    forceRoundFootprint: true,
  },
  "round-bead": {
    strandOccupancy: 1,
    anchorPreset: "center",
    rotationMode: "tangent",
    forceRoundFootprint: true,
  },
  charm: {
    strandOccupancy: 1,
    anchorPreset: "loop",
    anchorX: 0.5,
    anchorY: 0.08,
    verticalOffset: 0,
    visualScale: 1,
    rotationMode: "radial-upright",
    zPriority: 10,
    forceRoundFootprint: false,
  },
  spacer: {
    strandOccupancy: 0.38,
    anchorPreset: "center",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
    visualScale: 1,
  },
  separator: {
    strandOccupancy: 0.38,
    anchorPreset: "center",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
  },
  connector: {
    strandOccupancy: 0.45,
    anchorPreset: "center",
    rotationMode: "radial-upright",
    forceRoundFootprint: false,
    preferStrandImageUrl: true,
  },
};

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
  merged.strandOccupancy = Math.max(0.05, Math.min(2, merged.strandOccupancy));
  merged.visualScale = Math.max(0.25, Math.min(3, merged.visualScale));
  merged.stringOcclusion = Math.max(0, Math.min(1, merged.stringOcclusion));
  return merged;
}

export function parseStrandRenderProfile(raw: unknown): Partial<StrandRenderProfile> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const partial: Partial<StrandRenderProfile> = {};
  if (typeof o.strandOccupancy === "number") partial.strandOccupancy = o.strandOccupancy;
  if (typeof o.attachmentStyle === "string") {
    partial.attachmentStyle = o.attachmentStyle as StrandAttachmentStyle;
  }
  if (typeof o.anchorPreset === "string") partial.anchorPreset = o.anchorPreset as StrandAnchorPreset;
  if (typeof o.anchorX === "number") partial.anchorX = o.anchorX;
  if (typeof o.anchorY === "number") partial.anchorY = o.anchorY;
  if (typeof o.verticalOffset === "number") partial.verticalOffset = o.verticalOffset;
  if (typeof o.visualScale === "number") partial.visualScale = o.visualScale;
  if (typeof o.rotationMode === "string") partial.rotationMode = o.rotationMode as StrandRotationMode;
  if (typeof o.rotationOffsetDeg === "number") partial.rotationOffsetDeg = o.rotationOffsetDeg;
  if (typeof o.zPriority === "number") partial.zPriority = o.zPriority;
  if (typeof o.collisionPadding === "number") partial.collisionPadding = o.collisionPadding;
  if (typeof o.stringOcclusion === "number") partial.stringOcclusion = o.stringOcclusion;
  if (typeof o.forceRoundFootprint === "boolean") partial.forceRoundFootprint = o.forceRoundFootprint;
  if (typeof o.preferStrandImageUrl === "boolean") partial.preferStrandImageUrl = o.preferStrandImageUrl;
  return partial;
}
