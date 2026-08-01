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
}

/** CSS transform for a placed bead shell (Builder + Admin Preview). */
export function beadShellCssTransform(
  rotationDeg: number,
  options?: { dragOverlay?: boolean },
): string {
  const parts: string[] = [];
  if (options?.dragOverlay) parts.push("scale(1.02)");
  parts.push(`rotate(${rotationDeg}deg)`);
  return parts.join(" ");
}

/**
 * Resolve attachment, hang, scale, rotation, and transform-origin for one bead.
 * Both the Live Builder and Admin Preview must call this — no parallel math.
 */
export function calculateBeadRenderTransform(
  input: BeadRenderTransformInput,
): BeadRenderTransform {
  const { ringX, ringY, angleRad, slotDim, profile } = input;
  const renderDim = strandLayoutShellDimensions(slotDim, profile);
  const shell = computeBeadShellPosition(ringX, ringY, angleRad, slotDim, profile);
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
    cssTransform: beadShellCssTransform(rotationDeg),
    cssTransformOrigin: `${shell.transformOriginX}px ${shell.transformOriginY}px`,
  };
}
