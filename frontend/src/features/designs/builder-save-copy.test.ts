import { describe, expect, it } from "vitest";

import { labelForAutoSaveStatus } from "./builder-save-copy";

describe("builder save copy", () => {
  it("uses subtle explicit-save status labels", () => {
    expect(labelForAutoSaveStatus("pending")).toBe("● Unsaved Changes");
    expect(labelForAutoSaveStatus("saving")).toBe("Saving...");
    expect(labelForAutoSaveStatus("saved")).toBe("Saved");
    expect(labelForAutoSaveStatus("error")).toBe("Save failed");
    expect(labelForAutoSaveStatus("saved")).not.toContain("✓");
  });
});
