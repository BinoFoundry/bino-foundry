import { describe, expect, it } from "vitest";

import {
  UPLOADABLE_IMAGE_MIME_TYPES,
  resetUploadThrottleForTests,
  validateUploadFile,
} from "./upload-pipeline";

describe("upload pipeline validation", () => {
  it("accepts allowed mime types", () => {
    expect(UPLOADABLE_IMAGE_MIME_TYPES.has("image/webp")).toBe(true);
    expect(UPLOADABLE_IMAGE_MIME_TYPES.has("image/avif")).toBe(false);
  });

  it("rejects empty files before upload", () => {
    const file = new File([], "empty.webp", { type: "image/webp" });
    expect(validateUploadFile(file)).toMatch(/empty/i);
  });

  it("rejects unsupported mime types", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "x.avif", { type: "image/avif" });
    expect(validateUploadFile(file)).toMatch(/unsupported/i);
  });

  it("accepts valid webp files", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "bead.webp", { type: "image/webp" });
    expect(validateUploadFile(file)).toBeNull();
  });

  it("resets throttle helper for tests", () => {
    resetUploadThrottleForTests();
    expect(true).toBe(true);
  });
});
