import { describe, expect, it } from "vitest";

import { UnsupportedMediaError } from "../../lib/errors.js";
import { parsePublicCatalogUrl } from "../../infra/storage/catalog-object-storage.js";
import { ALLOWED_UPLOAD_MIME_TYPES } from "../../middleware/multer-image.js";

describe("upload pipeline guards", () => {
  it("allows storage-compatible mime types", () => {
    expect(ALLOWED_UPLOAD_MIME_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_UPLOAD_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_UPLOAD_MIME_TYPES.has("image/jpg")).toBe(true);
    expect(ALLOWED_UPLOAD_MIME_TYPES.has("image/heic")).toBe(false);
  });

  it("parses public Supabase asset URLs for rollback", () => {
    const parsed = parsePublicCatalogUrl(
      "https://example.supabase.co/storage/v1/object/public/assets/ui/admin/bino-foundry/abc.png",
    );
    expect(parsed).toEqual({
      bucket: "assets",
      objectKey: "ui/admin/bino-foundry/abc.png",
    });
  });

  it("maps storage mime rejection to HTTP 415", () => {
    const err = new UnsupportedMediaError("mime type image/heic is not supported");
    expect(err.statusCode).toBe(415);
    expect(err.code).toBe("UNSUPPORTED_MEDIA");
  });
});
