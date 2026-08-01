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
    request: { productType: "bracelet" },
    ...overrides,
  };
}

describe("builder local draft helpers", () => {
  it("keys drafts by product and design id", () => {
    expect(builderDraftKey("bracelet", null)).toBe("bracelet:new");
    expect(builderDraftKey("sunglasses", "dsn_1")).toBe("sunglasses:dsn_1");
  });

  it("only offers recovery when the draft differs from the baseline", () => {
    expect(isRecoverableDraft(draft(), "fp-base")).toBe(true);
    expect(isRecoverableDraft(draft({ fingerprint: "fp-base" }), "fp-base")).toBe(false);
    expect(isRecoverableDraft(null, "fp-base")).toBe(false);
  });
});
