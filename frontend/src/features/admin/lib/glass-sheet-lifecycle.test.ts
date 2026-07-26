import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/lib/upload-pipeline", () => ({
  uploadValidatedImage: vi.fn(async () => "https://cdn.example/assets/ui/admin/glass.png"),
  rollbackUploadedUrls: vi.fn(async () => undefined),
}));

import { uploadValidatedImage, rollbackUploadedUrls } from "@/features/admin/lib/upload-pipeline";
import {
  discardPendingGlassSheet,
  finalizeGlassSheetSettings,
  registerPendingGlassSheet,
} from "./glass-sheet-lifecycle";

describe("glass-sheet-lifecycle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("promotes a blob draft on save and deletes the previous permanent file", async () => {
    const file = new File(["sheet"], "sheet.png", { type: "image/png" });
    const blobUrl = "blob:http://localhost/draft-1";
    registerPendingGlassSheet(blobUrl, file);

    const result = await finalizeGlassSheetSettings(
      {
        glassSheetEnabled: true,
        glassSheetUrl: blobUrl,
        glassSheetColorStrength: 80,
      },
      "https://cdn.example/assets/ui/admin/old.png",
    );

    expect(uploadValidatedImage).toHaveBeenCalledWith(file);
    expect(rollbackUploadedUrls).toHaveBeenCalledWith([
      "https://cdn.example/assets/ui/admin/old.png",
    ]);
    expect(result.glassSheetUrl).toBe("https://cdn.example/assets/ui/admin/glass.png");
  });

  it("deletes the permanent file when the sheet is cleared", async () => {
    const result = await finalizeGlassSheetSettings(
      { glassSheetEnabled: false, glassSheetUrl: null },
      "https://cdn.example/assets/ui/admin/old.png",
    );

    expect(uploadValidatedImage).not.toHaveBeenCalled();
    expect(rollbackUploadedUrls).toHaveBeenCalledWith([
      "https://cdn.example/assets/ui/admin/old.png",
    ]);
    expect(result.glassSheetUrl).toBeNull();
  });

  it("discards a pending blob without uploading", () => {
    const file = new File(["sheet"], "sheet.png", { type: "image/png" });
    const blobUrl = "blob:http://localhost/draft-2";
    registerPendingGlassSheet(blobUrl, file);
    discardPendingGlassSheet(blobUrl);
    expect(uploadValidatedImage).not.toHaveBeenCalled();
  });
});
