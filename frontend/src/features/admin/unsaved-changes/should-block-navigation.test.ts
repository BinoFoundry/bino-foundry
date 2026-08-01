import { describe, expect, it } from "vitest";

import { shouldBlockAdminNavigation } from "./should-block-navigation";

describe("shouldBlockAdminNavigation", () => {
  it("allows navigation when clean", () => {
    expect(
      shouldBlockAdminNavigation(false, "/admin/frames/new", "/admin/beads"),
    ).toBe(false);
  });

  it("allows same-pathname search updates when dirty (crop panel deep link)", () => {
    expect(
      shouldBlockAdminNavigation(true, "/admin/frames/new", "/admin/frames/new"),
    ).toBe(false);
  });

  it("blocks pathname changes when dirty", () => {
    expect(
      shouldBlockAdminNavigation(true, "/admin/frames/new", "/admin/frames"),
    ).toBe(true);
    expect(
      shouldBlockAdminNavigation(true, "/admin/frames/new", "/admin/frames/abc"),
    ).toBe(true);
  });
});
