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

/** Moore-neighbor outer contour trace (clockwise). */
export function traceOuterContour(
  mask: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number }[] {
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

function simplifyRdp(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
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

/** Reduce a dense contour to a manageable polygon for the editor. */
export function simplifyContourToPolygon(
  points: { x: number; y: number }[],
  targetCount: number,
  maxDim: number,
): { x: number; y: number }[] {
  if (points.length <= targetCount) return points;
  let lo = 0;
  let hi = maxDim * 0.45;
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
