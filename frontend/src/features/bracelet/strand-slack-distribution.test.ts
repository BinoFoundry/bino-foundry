import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import { layoutStrandBeadShells } from "./layout-strand-bead-shells";
import { STRAND_PATH_START_ANGLE } from "./strand-path";

const withOverlap = (overlap: number) =>
  mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
    layoutMode: "dangling",
    anchorPreset: "loop",
    anchorY: 0.14,
    leadingOverlap: overlap,
    trailingOverlap: overlap,
    contactWidth: 1,
    contactOffset: 0,
    layoutScale: 1,
    visualSizeScaling: 1,
  });

function angles(profiles: ReturnType<typeof withOverlap>[], sizeMm = 6, wristMm = 180) {
  const layout = layoutStrandBeadShells({
    centerX: 300,
    centerY: 300,
    radiusPx: 200,
    wristCircumferenceMm: wristMm,
    startAngle: STRAND_PATH_START_ANGLE,
    balanceSpacing: true,
    beads: profiles.map((profile) => ({
      occupancyMm: sizeMm,
      slotDim: { width: 40, height: 40 },
      profile,
    })),
  });
  const twoPi = 2 * Math.PI;
  return layout.beads.map((b) => ((b.angleRad % twoPi) + twoPi) % twoPi);
}

function gapSpread(overlap: number, count: number) {
  const sorted = [...angles(Array.from({ length: count }, () => withOverlap(overlap)))].sort(
    (a, b) => a - b,
  );
  const twoPi = 2 * Math.PI;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!);
  gaps.push(twoPi - (sorted[sorted.length - 1]! - sorted[0]!));
  const bySize = [...gaps].sort((a, b) => a - b);
  return { biggest: bySize[bySize.length - 1]!, median: bySize[Math.floor(bySize.length / 2)]! };
}

describe("free arc on a strand where every junction hugs", () => {
  it("spreads the slack instead of banking it into one gap", () => {
    // A strand of charms two thirds full used to bunch together with a third of
    // the ring bare, while the capacity panel correctly reported it nearly full.
    const { biggest, median } = gapSpread(0.03, 20);
    expect(biggest / median).toBeLessThan(1.15);
  });

  it("still spreads evenly when nothing hugs", () => {
    const { biggest, median } = gapSpread(0, 20);
    expect(biggest / median).toBeLessThan(1.15);
  });

  it("lays a uniformly hugging strand out like one that does not hug at all", () => {
    // A hug cannot be honoured at every junction and still close the ring.
    const hugging = gapSpread(0.03, 20);
    const plain = gapSpread(0, 20);
    expect(Math.abs(hugging.biggest - plain.biggest)).toBeLessThan(0.02);
  });

  it("still pulls a hugging pair tighter when its neighbours do not hug", () => {
    // The bead-cap case: one piece tucks into its neighbour, the rest share the arc.
    const profiles = Array.from({ length: 8 }, (_, i) => withOverlap(i === 3 ? 0.35 : 0));
    const placed = angles(profiles);
    const gapAfter = (i: number) => {
      const twoPi = 2 * Math.PI;
      return ((placed[(i + 1) % placed.length]! - placed[i]! + twoPi) % twoPi);
    };
    expect(gapAfter(3)).toBeLessThan(gapAfter(5));
  });
});
