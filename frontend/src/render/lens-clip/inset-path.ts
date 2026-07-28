/**
 * Inset a closed SVG path (M/L/C/Z) by a pixel distance toward its centroid.
 * Used to build the Automatic Inner Frame ring (outer lens − inset hole).
 */

type Pt = { x: number; y: number };

type PathCommand =
  | { op: "M" | "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Z" };

function tokenizePathD(pathD: string): PathCommand[] {
  const trimmed = pathD.trim();
  if (!trimmed) return [];
  const chunks = trimmed.split(/(?=[MLCZ])/i).filter(Boolean);
  const commands: PathCommand[] = [];

  for (const chunk of chunks) {
    const op = chunk[0]?.toUpperCase();
    if (op !== "M" && op !== "L" && op !== "C" && op !== "Z") continue;
    const nums =
      op === "Z"
        ? []
        : chunk
            .slice(1)
            .trim()
            .split(/[\s,]+/)
            .filter(Boolean)
            .map((n) => Number.parseFloat(n))
            .filter((n) => Number.isFinite(n));

    if (op === "M" || op === "L") {
      if (nums.length >= 2) commands.push({ op, x: nums[0]!, y: nums[1]! });
    } else if (op === "C" && nums.length >= 6) {
      commands.push({
        op: "C",
        x1: nums[0]!,
        y1: nums[1]!,
        x2: nums[2]!,
        y2: nums[3]!,
        x: nums[4]!,
        y: nums[5]!,
      });
    } else if (op === "Z") {
      commands.push({ op: "Z" });
    }
  }
  return commands;
}

function cubicPoint(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  t: number,
): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Sample a closed path into a dense polyline (image / pixel space). */
export function sampleClosedPathD(pathD: string, samplesPerCurve = 8): Pt[] {
  const commands = tokenizePathD(pathD);
  const points: Pt[] = [];
  let cursor: Pt | null = null;
  let start: Pt | null = null;

  for (const cmd of commands) {
    if (cmd.op === "M") {
      cursor = { x: cmd.x, y: cmd.y };
      start = cursor;
      points.push(cursor);
    } else if (cmd.op === "L" && cursor) {
      cursor = { x: cmd.x, y: cmd.y };
      points.push(cursor);
    } else if (cmd.op === "C" && cursor) {
      const p0 = cursor;
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x2, y: cmd.y2 };
      const p3 = { x: cmd.x, y: cmd.y };
      for (let i = 1; i <= samplesPerCurve; i++) {
        points.push(cubicPoint(p0, p1, p2, p3, i / samplesPerCurve));
      }
      cursor = p3;
    } else if (cmd.op === "Z" && start && cursor) {
      if (Math.hypot(cursor.x - start.x, cursor.y - start.y) > 0.5) {
        points.push(start);
      }
      cursor = start;
    }
  }

  // Drop duplicate closing point if present.
  if (points.length > 2) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.5) {
      points.pop();
    }
  }
  return points;
}

function centroid(points: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, points.length);
  return { x: x / n, y: y / n };
}

function polylineToPathD(points: Pt[]): string {
  if (points.length < 3) return "";
  const fmt = (n: number) =>
    Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, "") : "0";
  const parts = [`M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${fmt(points[i]!.x)} ${fmt(points[i]!.y)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

/**
 * Inset a closed path toward its interior by `thickness` pixels.
 * Returns "" when thickness <= 0 or the path is unusable.
 */
export function insetClosedPathD(pathD: string, thickness: number): string {
  if (!(thickness > 0) || !pathD.trim()) return "";
  const samples = sampleClosedPathD(pathD);
  if (samples.length < 3) return "";

  const c = centroid(samples);
  const n = samples.length;
  const inset: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n]!;
    const curr = samples[i]!;
    const next = samples[(i + 1) % n]!;

    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len1 = Math.hypot(e1x, e1y) || 1;
    const len2 = Math.hypot(e2x, e2y) || 1;

    // Outward-ish edge normals (perpendicular). Average and flip toward centroid.
    let nx = -(e1y / len1) + -(e2y / len2);
    let ny = e1x / len1 + e2x / len2;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;

    // Ensure normal points inward (toward centroid).
    const toC = { x: c.x - curr.x, y: c.y - curr.y };
    if (nx * toC.x + ny * toC.y < 0) {
      nx = -nx;
      ny = -ny;
    }

    inset.push({
      x: curr.x + nx * thickness,
      y: curr.y + ny * thickness,
    });
  }

  return polylineToPathD(inset);
}

/**
 * Even-odd compound path for the Automatic Inner Frame ring:
 * outer lens opening minus the inset hole.
 */
export function innerFrameRingPathD(lensPathD: string, thickness: number): string | null {
  if (!(thickness > 0)) return null;
  const inset = insetClosedPathD(lensPathD, thickness);
  if (!inset) return null;
  const outer = lensPathD.trim();
  if (!outer) return null;
  return `${outer} ${inset}`;
}
