import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "./layout-strand-bead-shells";
import { STRAND_PATH_START_ANGLE } from "./strand-path";

const slotDim = { width: 30, height: 30 };
const CENTER = 200;
const RADIUS = 150;

const bead = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {});
/** A cap: narrow along the cord, and it tucks into whatever it sits against. */
const cap = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
  contactWidth: 0.4,
  leadingOverlap: 0.35,
  trailingOverlap: 0.35,
});
const capNoHug = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
  contactWidth: 0.4,
  leadingOverlap: 0,
  trailingOverlap: 0,
});

function arcs(profiles: typeof bead[]): { pairs: string[]; gaps: number[] } {
  const layout = layoutStrandBeadShells({
    centerX: CENTER,
    centerY: CENTER,
    radiusPx: RADIUS,
    wristCircumferenceMm: 160,
    startAngle: STRAND_PATH_START_ANGLE,
    balanceSpacing: true,
    beads: profiles.map((profile) => ({ occupancyMm: 8, slotDim, profile })),
  });
  const pts = layout.beads.map((b, i) => ({
    i,
    ang: Math.atan2(b.ringY - CENTER, b.ringX - CENTER),
    r: Math.hypot(b.ringX - CENTER, b.ringY - CENTER),
  }));
  const R = pts.reduce((s, p) => s + p.r, 0) / pts.length;
  const sorted = [...pts].sort((a, b) => a.ang - b.ang);
  const pairs: string[] = [];
  const gaps: number[] = [];
  sorted.forEach((p, k) => {
    const n = sorted[(k + 1) % sorted.length]!;
    let d = n.ang - p.ang;
    if (d < 0) d += 2 * Math.PI;
    pairs.push(`${p.i}>${n.i}`);
    gaps.push(d * R);
  });
  return { pairs, gaps };
}

describe("a cap hugging the bead beside it", () => {
  // cap · bead · cap · bead · bead · bead — the arrangement that failed.
  const layout = [cap, bead, cap, bead, bead, bead];

  it("seats a hugging cap closer than beads sit to each other", () => {
    // The regression: the balancing pass handed every junction the same empty
    // arc, so overlap was computed and then thrown away and no cap could hug.
    const { gaps } = arcs(layout);
    const widest = Math.max(...gaps);
    const tightest = Math.min(...gaps);
    expect(tightest).toBeLessThan(widest * 0.9);
  });

  it("closes up further than the same cap with no overlap set", () => {
    const hugging = Math.min(...arcs(layout).gaps);
    const plain = Math.min(...arcs([capNoHug, bead, capNoHug, bead, bead, bead]).gaps);
    expect(hugging).toBeLessThan(plain);
  });

  it("gives back to the other junctions what the hug takes", () => {
    // Total arc is fixed, so closing one gap must widen the rest, not shrink
    // the bracelet.
    const { gaps } = arcs(layout);
    const total = gaps.reduce((a, b) => a + b, 0);
    const plainTotal = arcs([capNoHug, bead, capNoHug, bead, bead, bead]).gaps.reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBeCloseTo(plainTotal, 3);
  });

  it("hugs by the same amount however full the strand is", () => {
    // A share of the free arc used to leak into the hug, so a cap drifted off
    // its bead on a sparse strand and only touched on a full one.
    const sparse = arcs([cap, bead, bead]);
    const full = arcs([cap, bead, bead, bead, bead, bead, bead, bead, bead, bead]);
    expect(Math.min(...sparse.gaps)).toBeCloseTo(Math.min(...full.gaps), 6);
  });

  it("leaves a strand with no overlaps evenly spaced", () => {
    const { gaps } = arcs(Array.from({ length: 8 }, () => bead));
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
  });

  it("never lets a pair close through each other", () => {
    const extreme = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
      contactWidth: 0.4,
      leadingOverlap: 5,
      trailingOverlap: 5,
    });
    const { gaps } = arcs([extreme, bead, extreme, bead, bead, bead]);
    for (const g of gaps) expect(g).toBeGreaterThan(0);
  });
});
