import { describe, expect, it } from "vitest";

import { labelForAutoSaveStatus } from "./builder-save-copy";

describe("builder save copy", () => {
  it("uses text-only status labels", () => {
    expect(labelForAutoSaveStatus("pending")).toBe("Unsaved changes");
    expect(labelForAutoSaveStatus("saving")).toBe("Saving...");
    expect(labelForAutoSaveStatus("saved")).toBe("All changes saved");
    expect(labelForAutoSaveStatus("error")).toBe("Save failed");
    expect(labelForAutoSaveStatus("saved")).not.toContain("✓");
  });
});
