import { normalizeBeadAnchor, type BeadPathAnchor } from "@bino-foundry/shared/types";

import type { ContourPoint } from "@/render/mask/mask-contour";

const DEG = 180 / Math.PI;

function turnAngleDeg(prev: ContourPoint, curr: ContourPoint, next: ContourPoint): number {
  const v1x = curr.x - prev.x;
  const v1y = curr.y - prev.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;
  const len1 = Math.hypot(v1x, v1y) || 1;
  const len2 = Math.hypot(v2x, v2y) || 1;
  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * DEG;
}

function tangentHandles(
  prev: ContourPoint,
  curr: ContourPoint,
  next: ContourPoint,
  tension = 0.28,
): { handleIn: ContourPoint; handleOut: ContourPoint } {
  const inDx = curr.x - prev.x;
  const inDy = curr.y - prev.y;
  const outDx = next.x - curr.x;
  const outDy = next.y - curr.y;
  return {
    handleIn: { x: curr.x - inDx * tension, y: curr.y - inDy * tension },
    handleOut: { x: curr.x + outDx * tension, y: curr.y + outDy * tension },
  };
}

export interface ContourToBeadPathOptions {
  /** Segments with turn angle below this use Bézier curves (degrees). */
  curveAngleThreshold?: number;
}

/**
 * Convert a simplified silhouette contour into editable Bézier anchors.
 * Curved segments follow organic edges; sharp corners stay as straight joins.
 */
export function contourToBeadPathAnchors(
  points: ContourPoint[],
  width: number,
  height: number,
  options: ContourToBeadPathOptions = {},
): { anchors: BeadPathAnchor[]; curvedSegmentCount: number } {
  const n = points.length;
  if (n < 3 || !width || !height) {
    return { anchors: [], curvedSegmentCount: 0 };
  }

  const curveThreshold = options.curveAngleThreshold ?? 158;
  const anchors: BeadPathAnchor[] = [];
  let curvedSegmentCount = 0;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;

    const turn = turnAngleDeg(prev, curr, next);
    const segmentIsCurved = turn < curveThreshold;

    if (segmentIsCurved) {
      curvedSegmentCount++;
      const { handleIn, handleOut } = tangentHandles(prev, curr, next);
      anchors.push(
        normalizeBeadAnchor({
          x: curr.x / width,
          y: curr.y / height,
          curved: true,
          handleIn: { x: handleIn.x / width, y: handleIn.y / height },
          handleOut: { x: handleOut.x / width, y: handleOut.y / height },
        }),
      );
    } else {
      anchors.push(
        normalizeBeadAnchor({
          x: curr.x / width,
          y: curr.y / height,
          curved: false,
          handleIn: null,
          handleOut: null,
        }),
      );
    }
  }

  return { anchors, curvedSegmentCount };
}
