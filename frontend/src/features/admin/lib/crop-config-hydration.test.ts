import { beforeEach, describe, expect, it, vi } from "vitest";

import { BEAD_CROP_CONFIG_V2, type BeadCropConfigV2 } from "@bino-foundry/shared/types";
import type { BeadLibrarySizeOffer } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";

const getLibrary = vi.fn();
vi.mock("@/services/api/beads", () => ({ beadsApi: { getLibrary: (id: string) => getLibrary(id) } }));

const { buildNormalizedRegenQueue, hydrateCropConfigs } = await import("./normalized-asset-regen");

function cropConfig(): BeadCropConfigV2 {
  return {
    version: BEAD_CROP_CONFIG_V2,
    imageWidth: 100,
    imageHeight: 100,
    originalUrl: "https://example.com/original.png",
    points: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.5, y: 0.8 },
    ],
    scale: 1,
    physicalMetrics: { visibleWidthPx: 60, visibleHeightPx: 60, referenceDiameterPx: 60 },
    updatedAt: 1,
  };
}

/** As the catalogue list returns them: no crop config. */
function listedLibrary(id: string): BeadLibraryEntry {
  return {
    id,
    name: id,
    image: "",
    originalImage: "https://example.com/original.png",
    beadTypeId: "crystal",
    description: "",
    cropConfig: null,
    cropStatus: "ready",
  };
}

function offer(libraryId: string, extra?: Partial<BeadLibrarySizeOffer>): BeadLibrarySizeOffer {
  return {
    id: `${libraryId}-6`,
    beadLibraryId: libraryId,
    beadSizeId: "size-6",
    sizeMm: 6,
    label: "6 mm",
    unitPrice: 1,
    offerKey: `${libraryId}-6`,
    ...extra,
  };
}

const beadSizes = [{ id: "s6", sizeMm: 6, label: "6 mm", groupReferenceDiameterPx: 400 }];
const beadTypes = [{ id: "crystal", slug: "crystal", name: "Crystal", description: "" }];

describe("crop config hydration", () => {
  beforeEach(() => {
    getLibrary.mockReset();
    getLibrary.mockImplementation(async (id: string) => ({ ...listedLibrary(id), cropConfig: cropConfig() }));
  });

  it("queues nothing when beads arrive without a crop config", () => {
    // The regression this guards: the catalogue list omits crop configs, every
    // bead was dropped, and the run reported success having done no work.
    const items = buildNormalizedRegenQueue(
      [listedLibrary("alpha")],
      [offer("alpha")],
      beadSizes,
      beadTypes,
      { scope: "all", force: false },
    );
    expect(items).toHaveLength(0);
  });

  it("fetches the crop config for beads with outstanding work, so they queue", async () => {
    const hydrated = await hydrateCropConfigs([listedLibrary("alpha")], [offer("alpha")]);
    expect(getLibrary).toHaveBeenCalledWith("alpha");
    expect(hydrated[0].cropConfig).not.toBeNull();

    const items = buildNormalizedRegenQueue(hydrated, [offer("alpha")], beadSizes, beadTypes, {
      scope: "all",
      force: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0].libraryId).toBe("alpha");
  });

  it("fetches already-exported beads too, so the coverage check can account for them", async () => {
    // Skipping these made them vanish from the run, and the job then failed its
    // own assertion that every refreshed factor was visited.
    await hydrateCropConfigs(
      [listedLibrary("alpha")],
      [offer("alpha", { normalizedProcessedImageUrl: "https://example.com/n.webp" })],
    );
    expect(getLibrary).toHaveBeenCalledWith("alpha");
  });

  it("ignores beads that hold no offers", async () => {
    await hydrateCropConfigs([listedLibrary("alpha"), listedLibrary("orphan")], [offer("alpha")]);
    expect(getLibrary).toHaveBeenCalledWith("alpha");
    expect(getLibrary).not.toHaveBeenCalledWith("orphan");
  });

  it("lets one unreadable bead through without sinking the run", async () => {
    getLibrary.mockImplementation(async (id: string) => {
      if (id === "beta") throw new Error("network");
      return { ...listedLibrary(id), cropConfig: cropConfig() };
    });

    const hydrated = await hydrateCropConfigs(
      [listedLibrary("alpha"), listedLibrary("beta")],
      [offer("alpha"), offer("beta")],
    );
    expect(hydrated.find((l) => l.id === "alpha")?.cropConfig).not.toBeNull();
    expect(hydrated.find((l) => l.id === "beta")?.cropConfig).toBeNull();
  });
});
