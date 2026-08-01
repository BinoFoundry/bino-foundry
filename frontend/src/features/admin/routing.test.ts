import { describe, expect, it } from "vitest";

import {
  adminBeadTypePath,
  adminResourcePath,
  adminSectionPath,
  adminSubTypePath,
  isAdminSection,
  parseAdminSection,
  withAdminSearch,
} from "./routing";

describe("admin routing", () => {
  it("builds section paths", () => {
    expect(adminSectionPath("dashboard")).toBe("/admin");
    expect(adminSectionPath("beads")).toBe("/admin/beads");
    expect(adminResourcePath("beads", "new")).toBe("/admin/beads/new");
    expect(adminResourcePath("frames", "abc")).toBe("/admin/frames/abc");
  });

  it("builds bead-type nested paths", () => {
    expect(adminBeadTypePath()).toBe("/admin/bead-types");
    expect(adminBeadTypePath("t1")).toBe("/admin/bead-types/t1");
    expect(adminSubTypePath("t1")).toBe("/admin/bead-types/t1/sub-types");
    expect(adminSubTypePath("t1", "s2")).toBe("/admin/bead-types/t1/sub-types/s2");
  });

  it("parses sections and preserves query", () => {
    expect(isAdminSection("beads")).toBe(true);
    expect(parseAdminSection("nope")).toBe("dashboard");
    expect(withAdminSearch("/admin/beads", "?q=tiger&page=2")).toBe(
      "/admin/beads?q=tiger&page=2",
    );
  });
});
