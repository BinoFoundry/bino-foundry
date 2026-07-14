const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
] as const;

export type ContourPoint = { x: number; y: number };

export interface ProcessContourOptions {
  /** Target vertex count after simplification (adaptive when omitted). */
  targetPoints?: number;
  /** Minimum spacing between retained contour samples (px). */
  minSpacing?: number;
  /** Chaikin smoothing passes (0–3). */
  smoothPasses?: number;
  /** Image max dimension — used for adaptive simplification epsilon. */
  maxDim?: number;
}

export interface ProcessedContour {
  rawPointCount: number;
  points: ContourPoint[];
  perimeter: number;
}

/** Moore-neighbor outer contour trace (clockwise). Preserves concave bends. */
export function traceOuterContour(
  mask: Uint8Array,
  width: number,
  height: number,
): ContourPoint[] {
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height && startX < 0; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        startX = x;
        startY = y;
        break;
      }
    }
  }
  if (startX < 0) return [];

  const path: { x: number; y: number }[] = [];
  let x = startX;
  let y = startY;
  let dir = 0;
  const maxSteps = width * height * 4;
  let steps = 0;

  do {
    path.push({ x, y });
    let found = false;
    const startDir = (dir + 5) % 8;
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = x + NEIGHBORS[d]!.dx;
      const ny = y + NEIGHBORS[d]!.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!mask[ny * width + nx]) continue;
      x = nx;
      y = ny;
      dir = d;
      found = true;
      break;
    }
    if (!found) break;
    steps++;
  } while ((x !== startX || y !== startY || path.length < 3) && steps < maxSteps);

  return path;
}

/** Drop densely sampled contour vertices while preserving spacing along the path. */
export function decimateContour(points: ContourPoint[], minSpacing: number): ContourPoint[] {
  if (points.length < 3) return points;
  const out = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]!;
    const p = points[i]!;
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minSpacing) out.push(p);
  }
  return out.length >= 3 ? out : points;
}

/** Chaikin corner-cutting — smooths pixel stair-steps without filling concavities. */
export function smoothContourChaikin(points: ContourPoint[], passes = 1): ContourPoint[] {
  if (points.length < 3 || passes < 1) return points;

  let current = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: ContourPoint[] = [];
    const n = current.length;
    for (let i = 0; i < n; i++) {
      const p0 = current[i]!;
      const p1 = current[(i + 1) % n]!;
      next.push(
        { x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 },
        { x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 },
      );
    }
    current = next;
  }
  return current;
}

export function contourPerimeter(points: ContourPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Pick a point budget from contour complexity (longer / more detailed silhouettes keep more vertices). */
export function adaptiveContourTargetCount(
  points: ContourPoint[],
  maxDim: number,
  minPoints = 16,
  maxPoints = 56,
): number {
  const perimeter = contourPerimeter(points);
  const perimeterRatio = perimeter / Math.max(1, maxDim * 4);
  const raw = Math.round(minPoints + perimeterRatio * (maxPoints - minPoints) * 2.2);
  return Math.max(minPoints, Math.min(maxPoints, raw));
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function simplifyRdp(points: ContourPoint[], epsilon: number): ContourPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i]!, points[0]!, points[end]!);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRdp(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyRdp(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0]!, points[end]!];
}

/** Reduce a dense open polyline while aiming for a target vertex count. */
export function simplifyContourToPolygon(
  points: ContourPoint[],
  targetCount: number,
  maxDim: number,
): ContourPoint[] {
  if (points.length <= targetCount) return points;
  // Keep epsilon small so shapes do not collapse to bounding-box corners.
  const maxEps = Math.max(1.25, maxDim * 0.02);
  let lo = 0;
  let hi = maxEps;
  let best = points;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const simplified = simplifyRdp(points, mid);
    if (simplified.length > targetCount) lo = mid;
    else {
      hi = mid;
      best = simplified;
    }
  }
  return best.length >= 3 ? best : points.slice(0, Math.max(3, targetCount));
}

/**
 * Closed-ring RDP: split at the farthest point from the start, simplify both arcs.
 * Open-polyline RDP on a closed ring collapses toward a box when endpoints are adjacent.
 */
export function simplifyClosedContourToPolygon(
  points: ContourPoint[],
  targetCount: number,
  maxDim: number,
): ContourPoint[] {
  if (points.length <= targetCount) return points;
  const start = points[0]!;
  let splitIdx = Math.floor(points.length / 2);
  let maxDist = -1;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i]!.x - start.x, points[i]!.y - start.y);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }

  const halfTarget = Math.max(4, Math.ceil(targetCount / 2) + 1);
  const arcA = simplifyContourToPolygon(points.slice(0, splitIdx + 1), halfTarget, maxDim);
  const arcB = simplifyContourToPolygon(
    [...points.slice(splitIdx), points[0]!],
    halfTarget,
    maxDim,
  );
  const merged = [...arcA.slice(0, -1), ...arcB.slice(0, -1)];
  if (merged.length <= targetCount) return merged.length >= 3 ? merged : points;
  // Fine pass with a tight epsilon budget (still closed-aware via prior arcs).
  return simplifyContourToPolygon(merged, targetCount, maxDim);
}

/** Uniform arc-length samples around a closed contour (preserves curved lens shapes). */
export function resampleClosedContour(points: ContourPoint[], count: number): ContourPoint[] {
  if (points.length < 3 || count < 3) return points;
  const n = points.length;
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLens.push(len);
    total += len;
  }
  if (total <= 1e-6) return points.slice(0, count);

  const out: ContourPoint[] = [];
  for (let i = 0; i < count; i++) {
    let target = (i / count) * total;
    if (target >= total) target = total - 1e-9;
    let acc = 0;
    for (let s = 0; s < n; s++) {
      const len = segLens[s]!;
      if (acc + len >= target) {
        const t = len < 1e-9 ? 0 : (target - acc) / len;
        const a = points[s]!;
        const b = points[(s + 1) % n]!;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
        break;
      }
      acc += len;
    }
  }
  return out;
}

/** How close a polygon is to its axis-aligned bounding box (1 = perfect rectangle fill). */
export function polygonRectangularity(points: ContourPoint[]): number {
  if (points.length < 3) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  area = Math.abs(area) * 0.5;
  return area / (bw * bh);
}

/**
 * Full silhouette processing: decimate → smooth → simplify.
 * Keeps concave detail by using light smoothing and adaptive point budgets.
 */
export function processSilhouetteContour(
  contour: ContourPoint[],
  width: number,
  height: number,
  options: ProcessContourOptions = {},
): ProcessedContour {
  const maxDim = options.maxDim ?? Math.max(width, height);
  const rawPointCount = contour.length;
  if (contour.length < 3) {
    return { rawPointCount, points: [], perimeter: 0 };
  }

  const minSpacing = options.minSpacing ?? Math.max(1, maxDim * 0.004);
  const decimated = decimateContour(contour, minSpacing);
  const smoothed = smoothContourChaikin(decimated, options.smoothPasses ?? 2);
  const target =
    options.targetPoints ?? adaptiveContourTargetCount(smoothed, maxDim);
  const simplified = simplifyClosedContourToPolygon(smoothed, target, maxDim);

  return {
    rawPointCount,
    points: simplified,
    perimeter: contourPerimeter(simplified),
  };
}

/**
 * Lens openings: prefer arc-length resampling over aggressive RDP so results
 * follow the true contour instead of collapsing into a bounding box.
 */
export function processLensOpeningContour(
  contour: ContourPoint[],
  width: number,
  height: number,
  options: ProcessContourOptions = {},
): ProcessedContour {
  const maxDim = options.maxDim ?? Math.max(width, height);
  const rawPointCount = contour.length;
  if (contour.length < 3) {
    return { rawPointCount, points: [], perimeter: 0 };
  }

  const minSpacing = options.minSpacing ?? Math.max(1, maxDim * 0.0025);
  const decimated = decimateContour(contour, minSpacing);
  const smoothed = smoothContourChaikin(decimated, options.smoothPasses ?? 3);
  const target = Math.max(16, options.targetPoints ?? adaptiveContourTargetCount(smoothed, maxDim));

  // Light closed RDP only to remove stair-step noise, then resample to a stable budget.
  const lightlySimplified = simplifyClosedContourToPolygon(
    smoothed,
    Math.max(target * 2, 48),
    maxDim,
  );
  let points = resampleClosedContour(lightlySimplified, target);

  // If RDP still produced a near-box, resample the smoothed contour directly.
  if (polygonRectangularity(points) > 0.92 && lightlySimplified.length >= target) {
    points = resampleClosedContour(smoothed, target);
  }

  return {
    rawPointCount,
    points,
    perimeter: contourPerimeter(points),
  };
}

export interface MaskComponent {
  id: number;
  size: number;
  centroidX: number;
  centroidY: number;
}

/** Flood-fill connected components in a binary mask. */
export function labelMaskComponents(mask: Uint8Array, width: number, height: number): MaskComponent[] {
  const labels = new Int32Array(mask.length);
  const components: MaskComponent[] = [];
  let nextId = 1;

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx] || labels[idx]) continue;
    const stack = [idx];
    labels[idx] = nextId;
    let size = 0;
    let sumX = 0;
    let sumY = 0;

    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      const x = cur % width;
      const y = (cur / width) | 0;
      sumX += x;
      sumY += y;

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || labels[ni]) continue;
        labels[ni] = nextId;
        stack.push(ni);
      }
    }

    components.push({
      id: nextId,
      size,
      centroidX: sumX / size,
      centroidY: sumY / size,
    });
    nextId++;
  }

  return components;
}

export function componentBitmap(
  mask: Uint8Array,
  labels: Int32Array,
  width: number,
  height: number,
  componentId: number,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let idx = 0; idx < mask.length; idx++) {
    if (labels[idx] === componentId) out[idx] = 1;
  }
  return out;
}

/** Label every foreground pixel with its component id. */
export function buildComponentLabels(mask: Uint8Array, width: number, height: number): Int32Array {
  const labels = new Int32Array(mask.length);
  let nextId = 1;

  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx] || labels[idx]) continue;
    const stack = [idx];
    labels[idx] = nextId;
    while (stack.length) {
      const cur = stack.pop()!;
      const x = cur % width;
      const y = (cur / width) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!mask[ni] || labels[ni]) continue;
        labels[ni] = nextId;
        stack.push(ni);
      }
    }
    nextId++;
  }

  return labels;
}
