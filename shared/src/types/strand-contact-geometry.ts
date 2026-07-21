import type { StrandRenderProfile } from "./strand-render-profile.js";
import { effectiveStrandContactWidth } from "./strand-render-profile.js";

/** Physical strand contact properties — spacing is independent of bitmap size. */
export interface StrandContactGeometry {
  /** Tangential arc as a fraction of the mm slot width (1 = full bead width). */
  contactWidth: number;
  /** Arc overlap with the previous neighbour (fraction of slot width). */
  leadingOverlap: number;
  /** Arc overlap with the next neighbour (fraction of slot width). */
  trailingOverlap: number;
  /**
   * Radial hang below the strand as a fraction of shell height.
   * Positive moves away from ring centre (hanging ornaments).
   */
  hangOffset: number;
}

export const DEFAULT_STRAND_CONTACT_GEOMETRY: StrandContactGeometry = {
  contactWidth: 1,
  leadingOverlap: 0,
  trailingOverlap: 0,
  hangOffset: 0,
};

/** Flatten resolved profile fields used for layout contact + shell anchor. */
export interface StrandLayoutGeometry extends StrandContactGeometry {
  visualScale: number;
  anchorX: number;
  anchorY: number;
}

export function contactGeometryFromProfile(
  profile: Pick<
    StrandRenderProfile,
    | "contactWidth"
    | "leadingOverlap"
    | "trailingOverlap"
    | "hangOffset"
    | "verticalOffset"
    | "visualScale"
    | "anchorX"
    | "anchorY"
  >,
): StrandLayoutGeometry {
  return {
    contactWidth: profile.contactWidth,
    leadingOverlap: profile.leadingOverlap,
    trailingOverlap: profile.trailingOverlap,
    hangOffset: profile.hangOffset !== 0 ? profile.hangOffset : profile.verticalOffset,
    visualScale: profile.visualScale,
    anchorX: profile.anchorX,
    anchorY: profile.anchorY,
  };
}

export interface ContactArcPx {
  contactArcPx: number;
  leadingOverlapPx: number;
  trailingOverlapPx: number;
}

export type StrandContactProfileFields = Pick<
  StrandRenderProfile,
  | "contactWidth"
  | "contactOffset"
  | "spacingAdjustment"
  | "leadingOverlap"
  | "trailingOverlap"
  | "collisionPadding"
>;

/**
 * Capacity-consistent contact arc along the wrist ring.
 *
 * Occupied length matches the mm charged by the capacity panel:
 *   baseArcPx = (sizeMm / wristCircumferenceMm) × ringCircumferencePx
 *   contactArcPx = baseArcPx × effectiveContactWidth(profile)
 *
 * Same formula for every bead type — crystals, spacers, charms, future types.
 * Contact width / adjustment remain data-driven tuning on top of the mm base.
 */
export function contactArcPxFromCapacityMm(
  sizeMm: number,
  wristCircumferenceMm: number,
  ringCircumferencePx: number,
  profile: StrandContactProfileFields,
  scaleFactor = 1,
): ContactArcPx {
  const wristMm = Math.max(wristCircumferenceMm, 1e-6);
  const circPx = Math.max(ringCircumferencePx, 1e-6);
  const baseArcPx = (Math.max(0, sizeMm) / wristMm) * circPx;
  const sf = Math.max(0.5, scaleFactor);
  const spanMultiplier = effectiveStrandContactWidth(profile);
  return {
    contactArcPx: baseArcPx * spanMultiplier + (profile.collisionPadding ?? 0) * sf,
    leadingOverlapPx: profile.leadingOverlap * baseArcPx,
    trailingOverlapPx: profile.trailingOverlap * baseArcPx,
  };
}

/**
 * @deprecated Prefer {@link contactArcPxFromCapacityMm} so layout occupancy matches capacity mm.
 * Convert visible tangent width to layout contact arc (px along strand).
 */
export function contactArcPxFromSlotWidth(
  slotWidthPx: number,
  profile: StrandContactProfileFields,
  scaleFactor = 1,
): ContactArcPx {
  const naturalTangentPx = Math.max(0, slotWidthPx);
  const sf = Math.max(0.5, scaleFactor);
  const spanMultiplier = effectiveStrandContactWidth(profile);
  return {
    contactArcPx: naturalTangentPx * spanMultiplier + (profile.collisionPadding ?? 0) * sf,
    leadingOverlapPx: profile.leadingOverlap * naturalTangentPx,
    trailingOverlapPx: profile.trailingOverlap * naturalTangentPx,
  };
}

/** Net tangential arc consumed by a closed loop (contact minus junction overlaps). */
export function netContactLoopArcPx(
  contactArcPx: number[],
  leadingOverlapPx: number[],
  trailingOverlapPx: number[],
): number {
  if (!contactArcPx.length) return 0;
  let total = 0;
  for (let i = 0; i < contactArcPx.length; i++) {
    total += contactArcPx[i]!;
    if (i > 0) {
      total -= trailingOverlapPx[i - 1]! + leadingOverlapPx[i]!;
    }
  }
  return Math.max(0, total);
}
