import { describe, expect, it, vi } from "vitest";

import {
  applyAdminSaveModalState,
  notifyAdminCreated,
  notifyAdminSavedEdit,
  notifyAdminSaveFailed,
} from "./admin-save-feedback";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("admin-save-feedback", () => {
  it("shows success toast on edit save", () => {
    notifyAdminSavedEdit();
    expect(toast.success).toHaveBeenCalledWith("Changes saved successfully.");
  });

  it("shows created toast with label", () => {
    notifyAdminCreated("Bead");
    expect(toast.success).toHaveBeenCalledWith("Bead created — continue configuring.");
  });

  it("shows error toast on save failure", () => {
    notifyAdminSaveFailed(new Error("Network error"));
    expect(toast.error).toHaveBeenCalledWith("Network error");
  });

  it("shows session-expired message for 401", async () => {
    const { ApiError } = await import("@/services/api/errors");
    notifyAdminSaveFailed(new ApiError(401, "Your session has expired. Please sign in again.", { code: "SESSION_EXPIRED" }));
    expect(toast.error).toHaveBeenCalledWith("Your session has expired. Please sign in again.");
  });

  it("shows permission message for 403", async () => {
    const { ApiError } = await import("@/services/api/errors");
    notifyAdminSaveFailed(new ApiError(403, "You do not have permission to modify the catalogue"));
    expect(toast.error).toHaveBeenCalledWith("You do not have permission to modify the catalogue");
  });


  it("stays on edit after update and opens edit after create", () => {
    const setModal = vi.fn();
    const saved = { id: "bead-1", name: "Amethyst" };

    applyAdminSaveModalState("edit", saved, setModal);
    expect(toast.success).toHaveBeenCalledWith("Changes saved successfully.");
    expect(setModal).toHaveBeenCalledWith({ type: "edit", entry: saved });

    setModal.mockClear();
    applyAdminSaveModalState("add", saved, setModal, { createdLabel: "Bead" });
    expect(toast.success).toHaveBeenCalledWith("Bead created — continue configuring.");
    expect(setModal).toHaveBeenCalledWith({ type: "edit", entry: saved });
  });
});
