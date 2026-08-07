import {
  contactArcPxFromCapacityMm,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

import { effectiveLayoutDiameterPx } from "./strand-ring-geometry";
import {
  calculateBeadRenderTransform,
  type BeadRenderTransform,
} from "./strand-bead-render-transform";
import {
  computeBalancedRadialStrandPathLayout,
  STRAND_PATH_START_ANGLE,
  strandLayoutShellDimensions,
  type BeadSlotDimensions,
} from "./strand-path";

export interface StrandBeadShellLayoutInput {
  occupancyMm: number;
  /** Physical/layout slot before visualScale (same as Builder prelimDims). */
  slotDim: BeadSlotDimensions;
  profile: StrandRenderProfile;
}

export interface LayoutStrandBeadShellsParams {
  centerX: number;
  centerY: number;
  radiusPx: number;
  /** Wrist circumference used for mm→arc occupancy (Builder wristSize). */
  wristCircumferenceMm: number;
  beads: StrandBeadShellLayoutInput[];
  startAngle?: number;
  balanceSpacing?: boolean;
}

export interface LaidOutStrandBeadShell extends BeadRenderTransform {
  index: number;
  arcSpan: number;
  occupancyMm: number;
}

export interface StrandBeadShellLayout {
  centerX: number;
  centerY: number;
  radiusPx: number;
  beads: LaidOutStrandBeadShell[];
  insertionAngles: number[];
  occupiedArcPx: number;
  isOverCapacity: boolean;
  /** mm→px contact arcs used for path layout (Builder debug / occupancy). */
  contactArcPx: number[];
  leadingOverlapPx: number[];
  trailingOverlapPx: number[];
}

/**
 * Shared strand shell layout pipeline used by Live Builder and Admin Preview.
 *
 * Steps (identical to SortableCircularStrand):
 * 1. mm occupancy → contact arcs (capacity-consistent; contactWidth/offsets tune span)
 * 2. path packing using max(occupancy, visual shell tangent) so mixed charms/crystals
 *    do not overlap when silhouettes exceed the mm arc
 * 3. per-bead {@link calculateBeadRenderTransform}
 *
 * Capacity panel still charges catalogue sizeMm; profile fields tune how beads sit.
 */
export function layoutStrandBeadShells(
  params: LayoutStrandBeadShellsParams,
): StrandBeadShellLayout {
  const {
    centerX,
    centerY,
    radiusPx: requestedRadius,
    wristCircumferenceMm,
    beads,
    startAngle = STRAND_PATH_START_ANGLE,
    balanceSpacing = true,
  } = params;

  if (!beads.length || requestedRadius <= 0) {
    return {
      centerX,
      centerY,
      radiusPx: requestedRadius,
      beads: [],
      insertionAngles: [startAngle],
      occupiedArcPx: 0,
      isOverCapacity: false,
      contactArcPx: [],
      leadingOverlapPx: [],
      trailingOverlapPx: [],
    };
  }

  const ringCircumferencePx = 2 * Math.PI * requestedRadius;
  const contactArcs = beads.map((bead) => {
    const base = contactArcPxFromCapacityMm(
      bead.occupancyMm,
      wristCircumferenceMm,
      ringCircumferencePx,
      bead.profile,
    );
    // layoutScale calibrates contact diameter without changing capacity mm.
    const contactArcPx = effectiveLayoutDiameterPx(base.contactArcPx, bead.profile.layoutScale);
    return {
      contactArcPx,
      leadingOverlapPx: base.leadingOverlapPx,
      trailingOverlapPx: base.trailingOverlapPx,
    };
  });

  const sequential = computeBalancedRadialStrandPathLayout({
    beads: beads.map((bead, i) => {
      const arc = contactArcs[i]!;
      // visualScale only on the mm→px slot; layoutScale is applied once via contact or below.
      const visualBase = strandLayoutShellDimensions(bead.slotDim, {
        ...bead.profile,
        layoutScale: 1,
      });
      const visualCalibrated = effectiveLayoutDiameterPx(
        visualBase.width,
        bead.profile.layoutScale,
      );
      const visualRadiusPx = Math.max(0, visualCalibrated) / 2;
      const occupancyRadiusPx = Math.max(0, arc.contactArcPx) / 2;
      // Pack on the larger of capacity arc vs rendered tangent width (each layout-scaled once).
      const packDiameterPx = Math.max(arc.contactArcPx, visualCalibrated);
      return {
        index: i,
        occupancyPx: packDiameterPx,
        visualRadiusPx: Math.max(occupancyRadiusPx, visualRadiusPx),
        // Pair nudge is already encoded in contactArc via effectiveStrandContactWidth.
        contactAdjustmentPx: 0,
      };
    }),
    centerX,
    centerY,
    radius: requestedRadius,
    startAngle,
    balanceSpacing,
    // Array order is the bracelet sequence. Never use largest-gap — it parks beads at
    // Top/Bottom/Right/Left anchors and reshuffles angular neighbours on every add.
    placement: "physical-contact",
  });

  const radiusPx = sequential.resolvedRadiusPx ?? requestedRadius;
  const pathLayout = sequential.beads;

  const laidOut: LaidOutStrandBeadShell[] = pathLayout.map((path) => {
    const input = beads[path.index]!;
    const arc = contactArcs[path.index]!;
    const visualBase = strandLayoutShellDimensions(input.slotDim, {
      ...input.profile,
      layoutScale: 1,
    });
    const visualCalibrated = effectiveLayoutDiameterPx(
      visualBase.width,
      input.profile.layoutScale,
    );
    const packDiameterPx = Math.max(arc.contactArcPx, visualCalibrated);
    const danglingHeight = effectiveLayoutDiameterPx(
      visualBase.height,
      input.profile.layoutScale,
    );
    // Shell equals packed physical footprint — layoutScale already baked into packDiameter.
    const slotForRender = {
      width: packDiameterPx,
      height:
        input.profile.layoutMode === "dangling"
          ? Math.max(packDiameterPx, danglingHeight)
          : packDiameterPx,
    };
    const transform = calculateBeadRenderTransform({
      ringX: path.x,
      ringY: path.y,
      angleRad: path.angle,
      slotDim: slotForRender,
      profile: { ...input.profile, layoutScale: 1, visualScale: 1 },
    });
    return {
      ...transform,
      index: path.index,
      arcSpan: path.arcSpan,
      occupancyMm: input.occupancyMm,
    };
  });

  // Preserve caller bead order (path may return by placement sequence).
  laidOut.sort((a, b) => a.index - b.index);

  return {
    centerX,
    centerY,
    radiusPx,
    beads: laidOut,
    insertionAngles: sequential.insertionAngles,
    occupiedArcPx: sequential.occupiedArcPx,
    isOverCapacity: sequential.isOverCapacity,
    contactArcPx: contactArcs.map((c) => c.contactArcPx),
    leadingOverlapPx: contactArcs.map((c) => c.leadingOverlapPx),
    trailingOverlapPx: contactArcs.map((c) => c.trailingOverlapPx),
  };
}

/** Closed SVG path through ring attachment points (cord under beads). */
export function strandCordPathFromShells(
  shells: Pick<LaidOutStrandBeadShell, "ringX" | "ringY">[],
): string {
  if (shells.length < 2) return "";
  let d = `M ${shells[0]!.ringX} ${shells[0]!.ringY}`;
  for (let i = 1; i < shells.length; i++) {
    d += ` L ${shells[i]!.ringX} ${shells[i]!.ringY}`;
  }
  return `${d} Z`;
}
