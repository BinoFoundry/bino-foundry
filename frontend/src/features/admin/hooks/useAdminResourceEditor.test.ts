import { describe, expect, it } from "vitest";

import { pathIsCreateRoute } from "./useAdminResourceEditor";

describe("pathIsCreateRoute", () => {
  it("detects trailing /new create segments", () => {
    expect(pathIsCreateRoute("/admin/beads/new")).toBe(true);
    expect(pathIsCreateRoute("/admin/frames/new")).toBe(true);
    expect(pathIsCreateRoute("/admin/bead-types/new")).toBe(true);
    expect(pathIsCreateRoute("/admin/bead-types/t1/sub-types/new")).toBe(true);
    expect(pathIsCreateRoute("/admin/sunglasses-config/tints/new")).toBe(true);
  });

  it("does not treat edit or list paths as create", () => {
    expect(pathIsCreateRoute("/admin/beads")).toBe(false);
    expect(pathIsCreateRoute("/admin/beads/bead_123")).toBe(false);
    expect(pathIsCreateRoute("/admin/bead-types/t1/sub-types")).toBe(false);
    expect(pathIsCreateRoute("/admin/frames/new-york")).toBe(false);
  });
});
