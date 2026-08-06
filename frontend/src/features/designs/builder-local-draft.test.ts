import { describe, expect, it } from "vitest";

import { builderDraftKey, isRecoverableDraft, type BuilderLocalDraft } from "./builder-local-draft";

function draft(overrides: Partial<BuilderLocalDraft> = {}): BuilderLocalDraft {
  return {
    key: "bracelet:new",
    productType: "bracelet",
    designId: null,
    fingerprint: "fp-draft",
    baselineFingerprint: "fp-base",
    updatedAt: 1,
    request: {
      productType: "bracelet",
      bracelet: {
        twinning: false,
        wristSizeCmA: 16,
        wristSizeCmB: 16,
        items: [
          {
            strandIndex: 0,
            slotPosition: 0,
            beadLibraryId: "bead-1",
            beadSizeMm: 8,
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("builder local draft helpers", () => {
  it("keys drafts by product and design id", () => {
    expect(builderDraftKey("bracelet", null)).toBe("bracelet:new");
    expect(builderDraftKey("sunglasses", "dsn_1")).toBe("sunglasses:dsn_1");
  });

  it("only offers recovery when the draft differs from the baseline", () => {
    expect(isRecoverableDraft(draft(), "fp-loaded")).toBe(true);
    expect(isRecoverableDraft(draft({ fingerprint: "fp-base" }), "fp-base")).toBe(false);
    expect(isRecoverableDraft(draft({ fingerprint: "fp-base", baselineFingerprint: "fp-base" }), "fp-loaded")).toBe(
      false,
    );
    expect(isRecoverableDraft(null, "fp-base")).toBe(false);
    // Do not prompt before the loaded baseline is known.
    expect(isRecoverableDraft(draft(), null)).toBe(false);
  });

  it("does not offer recovery for empty drafts", () => {
    expect(
      isRecoverableDraft(
        draft({
          request: {
            productType: "bracelet",
            bracelet: { twinning: false, wristSizeCmA: 16, wristSizeCmB: 16, items: [] },
          },
        }),
        "fp-loaded",
      ),
    ).toBe(false);
    expect(
      isRecoverableDraft(
        draft({
          request: { productType: "bracelet" },
        }),
        "fp-loaded",
      ),
    ).toBe(false);
  });
});
