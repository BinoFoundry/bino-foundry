import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import {
  computeBeadShellPosition,
  strandLayoutShellDimensions,
  strandRotationDeg,
  type BeadSlotDimensions,
} from "./strand-path";

export interface BeadRenderTransformInput {
  /** Ring attachment point (path layout centre). */
  ringX: number;
  ringY: number;
  /** Polar angle of the ring point (radians). */
  angleRad: number;
  /** Physical/layout slot size before hierarchical visualScale. */
  slotDim: BeadSlotDimensions;
  /** Fully resolved strand render profile. */
  profile: StrandRenderProfile;
  /** Catalogue size mm — drives visual size scaling curve (occupancy unchanged). */
  sizeMm?: number;
  /**
   * Opt-in photo size nudge (1 = unchanged). Does not change packing, hang, or visualScale.
   * Only applied when the admin enables Customize image size.
   */
  imageSizeAdjust?: number;
}

/**
 * Complete shell placement for one bead on the strand.
 * Single source of truth for Admin Preview and Live Builder.
 */
export interface BeadRenderTransform {
  ringX: number;
  ringY: number;
  angleRad: number;
  slotDim: BeadSlotDimensions;
  renderDim: BeadSlotDimensions;
  shellLeft: number;
  shellTop: number;
  transformOriginX: number;
  transformOriginY: number;
  rotationDeg: number;
  /** Same CSS transform string the Builder applies to the shell. */
  cssTransform: string;
  cssTransformOrigin: string;
  /** Opt-in image size nudge baked into cssTransform (1 = none). */
  imageSizeAdjust: number;
}

/** CSS transform for a placed bead shell (Builder + Admin Preview). */
export function beadShellCssTransform(
  rotationDeg: number,
  options?: { dragOverlay?: boolean; imageSizeAdjust?: number },
): string {
  const parts: string[] = [];
  const adjust = options?.imageSizeAdjust;
  if (options?.dragOverlay) parts.push("scale(1.02)");
  parts.push(`rotate(${rotationDeg}deg)`);
  if (
    typeof adjust === "number" &&
    Number.isFinite(adjust) &&
    adjust > 0 &&
    Math.abs(adjust - 1) > 1e-6
  ) {
    // Around transform-origin (attach / loop). Never applied unless opt-in adjust ≠ 1.
    parts.push(`scale(${adjust})`);
  }
  return parts.join(" ");
}

/**
 * Resolve attachment, hang, scale, rotation, and transform-origin for one bead.
 * Both the Live Builder and Admin Preview must call this — no parallel math.
 */
export function calculateBeadRenderTransform(
  input: BeadRenderTransformInput,
): BeadRenderTransform {
  const { ringX, ringY, angleRad, slotDim, profile, sizeMm } = input;
  const imageSizeAdjust =
    typeof input.imageSizeAdjust === "number" &&
    Number.isFinite(input.imageSizeAdjust) &&
    input.imageSizeAdjust > 0
      ? input.imageSizeAdjust
      : 1;
  const renderDim = strandLayoutShellDimensions(slotDim, profile, sizeMm);
  const shell = computeBeadShellPosition(ringX, ringY, angleRad, slotDim, profile, sizeMm);
  const rotationDeg = strandRotationDeg(angleRad, profile);
  return {
    ringX,
    ringY,
    angleRad,
    slotDim,
    renderDim,
    shellLeft: shell.left,
    shellTop: shell.top,
    transformOriginX: shell.transformOriginX,
    transformOriginY: shell.transformOriginY,
    rotationDeg,
    imageSizeAdjust,
    cssTransform: beadShellCssTransform(rotationDeg, { imageSizeAdjust }),
    cssTransformOrigin: `${shell.transformOriginX}px ${shell.transformOriginY}px`,
  };
}
