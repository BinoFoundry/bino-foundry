import { describe, expect, it } from "vitest";

import { DEFAULT_STRAND_RENDER_PROFILE, mergeStrandRenderProfile } from "@bino-foundry/shared/types";

import {
  calculateBeadRenderTransform,
  beadShellCssTransform,
} from "@/features/bracelet/strand-bead-render-transform";
import {
  computeBeadShellPosition,
  strandLayoutShellDimensions,
  strandRotationDeg,
} from "@/features/bracelet/strand-path";
import { calculateBeadCount } from "@/lib/luxe-data";
import type { BeadLibraryEntry } from "@/types/beads";

import { AdminDeferredNumberInput } from "./AdminDeferredNumberInput";
import {
  buildPreviewPlacedBeads,
  pickPreviewSizeOffer,
  previewBeadCount,
  previewPlacedBeadFromSample,
  StrandRenderLivePreview,
  STRAND_RENDER_PREVIEW_BEAD_MM,
  STRAND_RENDER_PREVIEW_WRIST_CM,
} from "./StrandRenderLivePreview";

describe("AdminDeferredNumberInput", () => {
  it("exports a deferred numeric control", () => {
    expect(typeof AdminDeferredNumberInput).toBe("function");
  });
});

describe("shared bead render transform", () => {
  it("matches lower-level Builder shell + rotation helpers", () => {
    const profile = mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, {
      visualScale: 1.15,
      hangOffset: 0.25,
      verticalOffset: 0,
      orientationMode: "outward",
      rotationOffsetDeg: 12,
      anchorX: 0.5,
      anchorY: 0.15,
    });
    const slotDim = { width: 40, height: 40 };
    const ringX = 120;
    const ringY = 80;
    const angleRad = -Math.PI / 2;

    const shared = calculateBeadRenderTransform({
      ringX,
      ringY,
      angleRad,
      slotDim,
      profile,
    });
    const shell = computeBeadShellPosition(ringX, ringY, angleRad, slotDim, profile);
    const renderDim = strandLayoutShellDimensions(slotDim, profile);
    const rotationDeg = strandRotationDeg(angleRad, profile);

    expect(shared.shellLeft).toBeCloseTo(shell.left, 8);
    expect(shared.shellTop).toBeCloseTo(shell.top, 8);
    expect(shared.transformOriginX).toBeCloseTo(shell.transformOriginX, 8);
    expect(shared.transformOriginY).toBeCloseTo(shell.transformOriginY, 8);
    expect(shared.renderDim.width).toBeCloseTo(renderDim.width, 8);
    expect(shared.rotationDeg).toBeCloseTo(rotationDeg, 8);
    expect(shared.cssTransform).toBe(beadShellCssTransform(rotationDeg));
  });
});

describe("Admin Live Preview Builder strand parity", () => {
  it("exports the preview that embeds the Builder strand stage", () => {
    expect(typeof StrandRenderLivePreview).toBe("function");
  });

  it("wraps sample beads as PlacedBead for Builder sizing", () => {
    const sample = { id: "bead-1", name: "Charm" } as BeadLibraryEntry;
    const placed = previewPlacedBeadFromSample(sample, {
      sizeMm: 12,
      label: "12mm",
      unitPrice: 10,
      offerKey: "bead-1:12",
    });
    expect(placed.bead).toBe(sample);
    expect(placed.size.sizeMm).toBe(12);
    expect(pickPreviewSizeOffer(sample, [], null, null, 8).sizeMm).toBe(8);
  });

  it("prefers the requested preview size when it is enabled", () => {
    const sample = { id: "bead-1", name: "Charm" } as BeadLibraryEntry;
    const offers = [
      {
        id: "a",
        beadLibraryId: "bead-1",
        beadSizeId: "s6",
        sizeMm: 6,
        label: "6 mm",
        unitPrice: 1,
        offerKey: "bead-1:6",
        isDefault: true,
      },
      {
        id: "b",
        beadLibraryId: "bead-1",
        beadSizeId: "s10",
        sizeMm: 10,
        label: "10 mm",
        unitPrice: 1,
        offerKey: "bead-1:10",
      },
    ];
    const picked = pickPreviewSizeOffer(sample, offers, 10, [6, 10]);
    expect(picked.sizeMm).toBe(10);
    expect(picked.offer?.sizeMm).toBe(10);
  });

  it("falls back when the preferred preview size is no longer enabled", () => {
    const sample = { id: "bead-1", name: "Charm" } as BeadLibraryEntry;
    const picked = pickPreviewSizeOffer(sample, [], 6, [8, 10]);
    expect(picked.sizeMm).toBe(8);
  });

  it("seeds a partial-fill strand like typical Builder use", () => {
    const sample = { id: "bead-1", name: "Charm" } as BeadLibraryEntry;
    const full = calculateBeadCount(STRAND_RENDER_PREVIEW_WRIST_CM, STRAND_RENDER_PREVIEW_BEAD_MM);
    const partial = previewBeadCount(STRAND_RENDER_PREVIEW_WRIST_CM, STRAND_RENDER_PREVIEW_BEAD_MM);
    expect(partial).toBeLessThanOrEqual(full);
    expect(partial).toBeGreaterThanOrEqual(8);

    const beads = buildPreviewPlacedBeads(
      sample,
      { sizeMm: STRAND_RENDER_PREVIEW_BEAD_MM, label: "8mm", unitPrice: 0, offerKey: "bead-1:8" },
      STRAND_RENDER_PREVIEW_WRIST_CM,
    );
    expect(beads).toHaveLength(partial);
  });
});
