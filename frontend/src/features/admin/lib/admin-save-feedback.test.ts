import { describe, expect, it } from "vitest";

import { ApiError } from "@/services/api/errors";

import { notifyAdminDeleteFailed } from "./admin-save-feedback";

describe("notifyAdminDeleteFailed", () => {
  it("maps conflict errors to user-visible messages via save failed helper", () => {
    const err = new ApiError(409, "Cannot delete — used in saved bracelet designs.", {
      code: "CONFLICT",
    });
    expect(err.message).toContain("Cannot delete");
    expect(() => notifyAdminDeleteFailed(err)).not.toThrow();
  });
});
