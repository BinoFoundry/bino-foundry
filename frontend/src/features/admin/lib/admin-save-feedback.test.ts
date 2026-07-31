import { describe, expect, it, vi, beforeEach } from "vitest";

import { ApiError } from "@/services/api/errors";

import { notifyAdminDeleteFailed, notifyAdminSaveFailed } from "./admin-save-feedback";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("notifyAdminSaveFailed", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("maps conflict errors to user-visible messages", () => {
    const err = new ApiError(409, "Cannot delete — used in saved bracelet designs.", {
      code: "CONFLICT",
    });
    notifyAdminDeleteFailed(err);
    expect(toast.error).toHaveBeenCalledWith("Cannot delete — used in saved bracelet designs.");
  });

  it("does not expose API key / auth implementation details", () => {
    notifyAdminSaveFailed(new ApiError(401, "Authentication required"));
    expect(toast.error).toHaveBeenCalledWith(
      "You do not have permission to modify this catalogue.",
    );

    notifyAdminSaveFailed(new ApiError(403, "You do not have permission to modify the catalogue"));
    expect(toast.error).toHaveBeenCalledWith(
      "You do not have permission to modify this catalogue.",
    );

    notifyAdminSaveFailed(new ApiError(503, "Unable to reach the server. Please try again.", {
      code: "NETWORK_ERROR",
    }));
    expect(toast.error).toHaveBeenCalledWith(
      "Something went wrong while saving your changes. Please try again.",
    );
  });
});
