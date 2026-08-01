import { useMemo } from "react";
import type { StrandRenderProfile } from "@bino-foundry/shared/types";

import {
  computeBeadShellPosition,
  strandLayoutShellDimensions,
  strandRotationDeg,
} from "@/features/bracelet/strand-path";

const PREVIEW_W = 300;
const PREVIEW_H = 176;
const BASE_SLOT_PX = 36;
/** Short bracelet arc (not a full ring). */
const ARC_RADIUS = 118;
const ARC_CENTER_X = PREVIEW_W / 2;
const ARC_CENTER_Y = PREVIEW_H + 36;
const BEAD_COUNT = 5;
/**
 * Fixed angular step — matches Builder mm-occupancy model.
 * Contact width / overlap do not change Builder spacing, so preview must not either.
 */
export const STRAND_RENDER_PREVIEW_ANGLE_STEP = 0.34;

export interface StrandRenderLivePreviewProps {
  profile: StrandRenderProfile;
  /** Optional sample asset; falls back to a neutral placeholder disc. */
  imageUrl?: string | null;
  className?: string;
}

interface PreviewBeadLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  rotationDeg: number;
  isFocus: boolean;
}

export function buildCurvedPreview(profile: StrandRenderProfile): {
  arcPath: string;
  beads: PreviewBeadLayout[];
} {
  const slot = { width: BASE_SLOT_PX, height: BASE_SLOT_PX };
  const renderDim = strandLayoutShellDimensions(slot, profile);
  const mid = Math.floor(BEAD_COUNT / 2);
  const angles = Array.from(
    { length: BEAD_COUNT },
    (_, i) => -Math.PI / 2 + (i - mid) * STRAND_RENDER_PREVIEW_ANGLE_STEP,
  );

  const start = angles[0]!;
  const end = angles[angles.length - 1]!;
  const x0 = ARC_CENTER_X + ARC_RADIUS * Math.cos(start);
  const y0 = ARC_CENTER_Y + ARC_RADIUS * Math.sin(start);
  const x1 = ARC_CENTER_X + ARC_RADIUS * Math.cos(end);
  const y1 = ARC_CENTER_Y + ARC_RADIUS * Math.sin(end);
  const arcPath = `M ${x0} ${y0} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${x1} ${y1}`;

  const beads = angles.map((angle, index) => {
    const ringX = ARC_CENTER_X + ARC_RADIUS * Math.cos(angle);
    const ringY = ARC_CENTER_Y + ARC_RADIUS * Math.sin(angle);
    const shell = computeBeadShellPosition(ringX, ringY, angle, slot, profile);
    return {
      left: shell.left,
      top: shell.top,
      width: renderDim.width,
      height: renderDim.height,
      originX: shell.transformOriginX,
      originY: shell.transformOriginY,
      rotationDeg: strandRotationDeg(angle, profile),
      isFocus: index === mid,
    };
  });

  return { arcPath, beads };
}

/**
 * Lightweight curved-strand preview for admin render defaults.
 * Applies the same visual fields as the Builder (scale, hang, rotation, anchor).
 * Spacing stays fixed — Builder occupancy is mm-based, not contactWidth.
 */
export function StrandRenderLivePreview({
  profile,
  imageUrl,
  className,
}: StrandRenderLivePreviewProps) {
  const { arcPath, beads } = useMemo(() => buildCurvedPreview(profile), [profile]);
  const src = imageUrl?.trim() || null;
  const round = profile.forceRoundFootprint;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Live Preview</p>
          <p className="text-xs text-muted-foreground">
            Same visual resolve as the Builder (scale, hang, rotation). Spacing is mm-based and
            unchanged by contact width.
          </p>
        </div>
        <p className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          Scale {profile.visualScale.toFixed(2)}×
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-muted/40 to-muted/10"
        style={{ width: "100%", maxWidth: PREVIEW_W, height: PREVIEW_H }}
        aria-hidden
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d={arcPath}
            fill="none"
            stroke="hsl(var(--strand-cord, 28 30% 55%) / 0.7)"
            strokeWidth={3.2}
            strokeLinecap="round"
          />
        </svg>

        {beads.map((bead, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              left: bead.left,
              top: bead.top,
              width: bead.width,
              height: bead.height,
              transformOrigin: `${bead.originX}px ${bead.originY}px`,
              transform: `rotate(${bead.rotationDeg}deg)`,
              opacity: bead.isFocus ? 1 : 0.7,
              zIndex: bead.isFocus ? 2 : 1,
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
                style={{
                  borderRadius: round ? "50%" : 6,
                  background: "transparent",
                }}
              />
            ) : (
              <div
                className="h-full w-full border border-border/60 shadow-sm"
                style={{
                  borderRadius: round ? "50%" : 6,
                  background:
                    "radial-gradient(circle at 35% 30%, hsl(var(--muted-foreground) / 0.22), hsl(var(--muted-foreground) / 0.45))",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
