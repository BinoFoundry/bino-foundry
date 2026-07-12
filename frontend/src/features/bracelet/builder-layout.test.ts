import { describe, expect, it } from "vitest";

import {
  BEAD_LIBRARY_DRAWER_CLASS,
  BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP,
  BEAD_LIBRARY_SIDEBAR_CLASS_WIDE,
  beadLibrarySidebarWidthClass,
} from "./builder-layout";

describe("bead library sidebar widths", () => {
  it("widens laptop docked column by roughly 10%", () => {
    expect(BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP).toContain("208px");
    expect(BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP).toContain("24vw");
  });

  it("widens wide desktop docked column by roughly 10%", () => {
    expect(BEAD_LIBRARY_SIDEBAR_CLASS_WIDE).toContain("244px");
    expect(BEAD_LIBRARY_SIDEBAR_CLASS_WIDE).toContain("22vw");
  });

  it("selects width class by breakpoint flag", () => {
    expect(beadLibrarySidebarWidthClass(false)).toBe(BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP);
    expect(beadLibrarySidebarWidthClass(true)).toBe(BEAD_LIBRARY_SIDEBAR_CLASS_WIDE);
  });

  it("caps tablet drawer width", () => {
    expect(BEAD_LIBRARY_DRAWER_CLASS).toContain("330px");
    expect(BEAD_LIBRARY_DRAWER_CLASS).toContain("352px");
  });
});
