import { createCanvas } from "../engine/canvas/lens-compositor";
import {
  defaultHandlesForSegment,
  migrateAnchors,
  normalizeAnchor,
  type LensPolygon,
  type PathAnchor,
} from "./mask-types";

/**
 * @param {import('./types.js').PathAnchor} p
 * @param {number} w
 * @param {number} h
 */
export function anchorPx(p, w, h) {
  return { x: p.x * w, y: p.y * h };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
export function normFromPx(x, y, w, h) {
  return { x: x / w, y: y / h };
}

/**
 * @param {import('./types.js').PathAnchor} a
 * @param {import('./types.js').PathAnchor} b
 * @param {number} w
 * @param {number} h
 */
export function segmentControls(a, b, w, h) {
  const p0 = anchorPx(a, w, h);
  const p3 = anchorPx(b, w, h);
  if (!a.curved) {
    return { p0, p1: p0, p2: p3, p3, straight: true };
  }
  let p1 = a.handleOut ? anchorPx(a.handleOut, w, h) : null;
  let p2 = b.handleIn ? anchorPx(b.handleIn, w, h) : null;
  if (!p1 || !p2) {
    const defs = defaultHandlesForSegment(a, b, w, h);
    if (!p1) p1 = anchorPx({ ...a, handleOut: defs.handleOut }, w, h);
    if (!p2) p2 = anchorPx({ ...b, handleIn: defs.handleIn }, w, h);
  }
  return { p0, p1, p2, p3, straight: false };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./types.js').LensPolygon} lens
 * @param {number} w
 * @param {number} h
 * @param {boolean} closed
 */
export function traceLensPath(ctx, lens, w, h, closed = true) {
  const points = migrateAnchors(lens.points);
  if (points.length < 2) return;
  const n = points.length;
  const p0 = anchorPx(points[0], w, h);
  ctx.moveTo(p0.x, p0.y);
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const seg = segmentControls(a, b, w, h);
    if (seg.straight) ctx.lineTo(seg.p3.x, seg.p3.y);
    else ctx.bezierCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
  }
  if (closed && n >= 3) ctx.closePath();
}

/**
 * @param {number} width
 * @param {number} height
 * @param {import('./types.js').LensPolygon[]} lenses
 */
export function pathsToMaskCanvas(width, height, lenses) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  for (const lens of lenses) {
    const pts = migrateAnchors(lens.points);
    if (pts.length < 3) continue;
    ctx.beginPath();
    traceLensPath(ctx, lens, width, height, true);
    ctx.fill();
  }
  return canvas;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./types.js').LensPolygon} lens
 * @param {number} w
 * @param {number} h
 * @param {{ fill?: string | null, stroke?: string, lineWidth?: number, showHandles?: boolean, active?: boolean }} style
 */
export function drawLensPath(ctx, lens, w, h, style = {}) {
  const points = migrateAnchors(lens.points);
  if (points.length < 2) return;
  const {
    fill = 'rgba(0, 120, 255, 0.25)',
    stroke = '#0078ff',
    lineWidth = 2,
    showHandles = false,
    active = false,
  } = style;

  ctx.beginPath();
  traceLensPath(ctx, lens, w, h, points.length >= 3);
  if (fill != null && fill !== '' && points.length >= 3) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  if (!showHandles || !active) return;
  const n = points.length;
  ctx.setLineDash([4 / Math.max(lineWidth, 1), 4 / Math.max(lineWidth, 1)]);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const ap = anchorPx(a, w, h);
    const drawHandleLine = (hp, color) => {
      if (!hp) return;
      const hpx = anchorPx(hp, w, h);
      ctx.beginPath();
      ctx.moveTo(ap.x, ap.y);
      ctx.lineTo(hpx.x, hpx.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 0.75;
      ctx.stroke();
    };
    drawHandleLine(a.handleIn, 'rgba(0, 120, 255, 0.5)');
    drawHandleLine(a.handleOut, 'rgba(0, 120, 255, 0.5)');
    const next = points[(i + 1) % n];
    if (a.curved && next) {
      const seg = segmentControls(a, next, w, h);
      if (!seg.straight) {
        ctx.beginPath();
        ctx.moveTo(seg.p0.x, seg.p0.y);
        ctx.lineTo(seg.p1.x, seg.p1.y);
        ctx.moveTo(seg.p3.x, seg.p3.y);
        ctx.lineTo(seg.p2.x, seg.p2.y);
        ctx.strokeStyle = 'rgba(0, 120, 255, 0.3)';
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
}

/** Cubic Bézier at t. */
export function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function distToLine(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{ p0,p1,p2,p3, straight? }} seg
 * @param {number} samples
 */
export function distToSegment(px, py, seg, samples = 20) {
  if (seg.straight) {
    return { dist: distToLine(px, py, seg.p0.x, seg.p0.y, seg.p3.x, seg.p3.y), t: 0.5 };
  }
  let min = Infinity;
  let bestT = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = cubicAt(seg.p0, seg.p1, seg.p2, seg.p3, t);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < min) {
      min = d;
      bestT = t;
    }
  }
  return { dist: min, t: bestT };
}

/**
 * @param {number} px
 * @param {number} py
 * @param {import('./types.js').PathAnchor[]} points
 * @param {number} w
 * @param {number} h
 */
export function hitTestVertex(px, py, points, w, h, radius = 10) {
  const pts = migrateAnchors(points);
  for (let i = 0; i < pts.length; i++) {
    const p = anchorPx(pts[i], w, h);
    if (Math.hypot(px - p.x, py - p.y) <= radius) return { type: 'anchor', index: i };
  }
  return null;
}

/**
 * @param {number} px
 * @param {number} py
 * @param {import('./types.js').PathAnchor[]} points
 * @param {number} w
 * @param {number} h
 */
export function hitTestHandle(px, py, points, w, h, radius = 9) {
  const pts = migrateAnchors(points);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    if (a.handleIn) {
      const hpx = anchorPx(a.handleIn, w, h);
      if (Math.hypot(px - hpx.x, py - hpx.y) <= radius) {
        return { type: 'handleIn', index: i };
      }
    }
    if (a.handleOut) {
      const hpx = anchorPx(a.handleOut, w, h);
      if (Math.hypot(px - hpx.x, py - hpx.y) <= radius) {
        return { type: 'handleOut', index: i };
      }
    }
  }
  return null;
}

/**
 * Closest edge; returns hit info for insert.
 */
export function hitTestPathEdge(px, py, points, w, h, threshold = 10) {
  const pts = migrateAnchors(points);
  if (pts.length < 2) return null;
  const n = pts.length;
  let best = { dist: Infinity, insertAt: -1, t: 0.5, segIndex: -1 };
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const seg = segmentControls(a, b, w, h);
    const hit = distToSegment(px, py, seg, 24);
    if (hit.dist < best.dist) {
      best = { dist: hit.dist, insertAt: i + 1, t: hit.t, segIndex: i };
    }
  }
  return best.dist <= threshold ? best : null;
}

/**
 * Insert anchor on segment at parameter t.
 * @param {import('./types.js').PathAnchor[]} points
 * @returns {import('./types.js').PathAnchor[]}
 */
export function insertPointOnSegment(points, segIndex, t, w, h) {
  const pts = migrateAnchors(points);
  const a = pts[segIndex];
  const b = pts[(segIndex + 1) % pts.length];
  const seg = segmentControls(a, b, w, h);
  let pos;
  if (seg.straight) {
    pos = {
      x: seg.p0.x + (seg.p3.x - seg.p0.x) * t,
      y: seg.p0.y + (seg.p3.y - seg.p0.y) * t,
    };
  } else {
    pos = cubicAt(seg.p0, seg.p1, seg.p2, seg.p3, t);
  }
  const anchor = normalizeAnchor({
    x: pos.x / w,
    y: pos.y / h,
    curved: false,
    handleIn: null,
    handleOut: null,
  });
  pts.splice(segIndex + 1, 0, anchor);
  return pts;
}

/**
 * Toggle segment from anchor[index] → next as curved/straight.
 */
export function toggleSegmentCurved(points, index, w, h) {
  const pts = migrateAnchors(points);
  const a = pts[index];
  const next = pts[(index + 1) % pts.length];
  if (!next) return pts;
  a.curved = !a.curved;
  if (a.curved) {
    const defs = defaultHandlesForSegment(a, next, w, h);
    if (!a.handleOut) a.handleOut = { ...defs.handleOut };
    if (!next.handleIn) next.handleIn = { ...defs.handleIn };
  }
  return pts;
}

/** @deprecated use pathsToMaskCanvas */
export const polygonsToMaskCanvas = pathsToMaskCanvas;
