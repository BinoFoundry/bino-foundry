import { describe, expect, it } from "vitest";

import { ApiError } from "@/services/api/errors";

import { formatDesignSaveError } from "./format-design-save-error";

describe("formatDesignSaveError", () => {
  it("maps unavailable size/bead API errors to replace-before-save copy", () => {
    const err = new ApiError(
      400,
      "Some items in this design are no longer available. Please replace them before saving your design.",
    );
    expect(formatDesignSaveError(err)).toMatch(/no longer available/i);
  });

  it("maps session expiry clearly", () => {
    expect(formatDesignSaveError(new ApiError(401, "Unauthorized"))).toMatch(/session has expired/i);
  });

  it("keeps specific validation messages when safe", () => {
    expect(formatDesignSaveError(new ApiError(400, "At least one bead must be placed to save a configuration"))).toMatch(
      /at least one bead/i,
    );
  });

  it("falls back for opaque server failures", () => {
    expect(formatDesignSaveError(new ApiError(500, "Unexpected server error"))).toMatch(
      /couldn't save your design/i,
    );
  });
});
