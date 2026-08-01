import { describe, expect, it } from "vitest";

import {
  adminBeadTypePath,
  adminResourcePath,
  adminSectionPath,
  adminSubTypePath,
  adminSunglassesConfigPath,
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

  it("builds sunglasses-config nested paths", () => {
    expect(adminSunglassesConfigPath()).toBe("/admin/sunglasses-config");
    expect(adminSunglassesConfigPath("tints")).toBe("/admin/sunglasses-config/tints");
    expect(adminSunglassesConfigPath("tints", "new")).toBe("/admin/sunglasses-config/tints/new");
    expect(adminSunglassesConfigPath("options", "abc")).toBe("/admin/sunglasses-config/options/abc");
  });

  it("parses sections and preserves query", () => {
    expect(isAdminSection("beads")).toBe(true);
    expect(parseAdminSection("nope")).toBe("dashboard");
    expect(withAdminSearch("/admin/beads", "?q=tiger&page=2")).toBe(
      "/admin/beads?q=tiger&page=2",
    );
  });
});
