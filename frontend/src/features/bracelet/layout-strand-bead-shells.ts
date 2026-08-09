import {
  contactArcPxFromCapacityMm,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

import { visualSizeCurveRelativeFactor } from "@/render/bead-crop/visual-bead-scale";

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
 * Linear (curve-neutral) visual + pack footprint for one bead.
 * Shared by Crystal / Charm / Spacer / Connector / Separator / Accent — profile-driven only.
 *
 * - Tangential pack uses max(contact, visual width) so occupancy spacing stays capacity-correct.
 * - Dangling types (charms) may extend height past the pack width for the CSS shell.
 * - visualSizeScaling is applied once afterward as a uniform factor on the pack box.
 */
export function resolveStrandShellFootprint(params: {
  occupancyMm: number;
  slotDim: BeadSlotDimensions;
  profile: StrandRenderProfile;
  contactArcPx: number;
}): {
  visualWidthLinear: number;
  visualHeightLinear: number;
  packLinearWidth: number;
  packLinearHeight: number;
  /** Tangential footprint used for neighbour packing (curve-neutral). */
  packDiameterPx: number;
  /** CSS shell after size-curve factor (preserves 6mm / linear absolute size). */
  renderDim: BeadSlotDimensions;
  curveFactor: number;
} {
  const { occupancyMm, slotDim, profile, contactArcPx } = params;
  const visualBaseLinear = strandLayoutShellDimensions(
    slotDim,
    {
      ...profile,
      layoutScale: 1,
      visualSizeScaling: 1,
    },
    occupancyMm,
  );
  const visualWidthLinear = effectiveLayoutDiameterPx(
    visualBaseLinear.width,
    profile.layoutScale,
  );
  const visualHeightLinear = effectiveLayoutDiameterPx(
    visualBaseLinear.height,
    profile.layoutScale,
  );
  const packLinearWidth = Math.max(contactArcPx, visualWidthLinear);
  const packLinearHeight =
    profile.layoutMode === "dangling"
      ? Math.max(packLinearWidth, visualHeightLinear)
      : packLinearWidth;
  const curveFactor = visualSizeCurveRelativeFactor(
    occupancyMm,
    profile.visualSizeScaling ?? 1,
  );
  return {
    visualWidthLinear,
    visualHeightLinear,
    packLinearWidth,
    packLinearHeight,
    packDiameterPx: packLinearWidth,
    renderDim: {
      width: packLinearWidth * curveFactor,
      height: packLinearHeight * curveFactor,
    },
    curveFactor,
  };
}

/**
 * Shared strand shell layout pipeline used by Live Builder and Admin Preview.
 *
 * Steps (identical to SortableCircularStrand):
 * 1. mm occupancy → contact arcs (capacity-consistent; contactWidth/offsets tune span)
 * 2. path packing using max(occupancy, visual shell tangent) so mixed charms/crystals
 *    do not overlap when silhouettes exceed the mm arc
 * 3. per-bead CSS shell = linear pack footprint × size-curve factor
 *
 * Absolute size at the curve anchor (6mm) and at visualSizeScaling=1 matches the
 * previous contact-driven render. Exponents below 1 only soften jumps for larger mm.
 * Occupancy / spacing stay linear in catalogue mm.
 * Works for every dynamic type via {@link StrandRenderProfile} — no category branches.
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

  const footprints = beads.map((bead, i) =>
    resolveStrandShellFootprint({
      occupancyMm: bead.occupancyMm,
      slotDim: bead.slotDim,
      profile: bead.profile,
      contactArcPx: contactArcs[i]!.contactArcPx,
    }),
  );

  const sequential = computeBalancedRadialStrandPathLayout({
    beads: beads.map((bead, i) => {
      const arc = contactArcs[i]!;
      const footprint = footprints[i]!;
      const visualRadiusPx = Math.max(0, footprint.visualWidthLinear) / 2;
      const occupancyRadiusPx = Math.max(0, arc.contactArcPx) / 2;
      return {
        index: i,
        occupancyPx: footprint.packDiameterPx,
        visualRadiusPx: Math.max(occupancyRadiusPx, visualRadiusPx),
        contactAdjustmentPx: 0,
      };
    }),
    centerX,
    centerY,
    radius: requestedRadius,
    startAngle,
    balanceSpacing,
    placement: "physical-contact",
  });

  const radiusPx = sequential.resolvedRadiusPx ?? requestedRadius;
  const pathLayout = sequential.beads;

  const laidOut: LaidOutStrandBeadShell[] = pathLayout.map((path) => {
    const input = beads[path.index]!;
    const footprint = footprints[path.index]!;
    const transform = calculateBeadRenderTransform({
      ringX: path.x,
      ringY: path.y,
      angleRad: path.angle,
      slotDim: footprint.renderDim,
      // Neutralise scale fields already baked into renderDim (avoid double application).
      // Keep hangOffset / anchors / layoutMode / orientation for charm dangling placement.
      profile: { ...input.profile, layoutScale: 1, visualScale: 1, visualSizeScaling: 1 },
      sizeMm: input.occupancyMm,
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
