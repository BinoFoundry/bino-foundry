import { describe, expect, it } from "vitest";

import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
import type { CatalogAvailabilityStatus } from "@/types/catalog-availability";

import { selectBuilderCatalogue } from "./builder-catalogue";

const statuses: CatalogAvailabilityStatus[] = [
  {
    code: "ACTIVE",
    label: "Active",
    description: "",
    showInBuilder: true,
    allowNewDesigns: true,
    displayOrder: 0,
  },
  {
    code: "INACTIVE",
    label: "Inactive",
    description: "",
    showInBuilder: false,
    allowNewDesigns: false,
    displayOrder: 1,
  },
];

function type(id: string, name: string, isActive = true): BeadTypeEntry {
  return { id, slug: name.toLowerCase(), name, description: "", isActive };
}

function subType(id: string, beadTypeId: string, name: string, isActive = true): SubBeadTypeEntry {
  return { id, beadTypeId, slug: name.toLowerCase(), name, description: "", isActive };
}

function bead(
  id: string,
  beadTypeId: string,
  subBeadTypeId?: string,
  availabilityStatusCode = "ACTIVE",
): BeadLibraryEntry {
  return {
    id,
    name: id,
    image: "",
    beadTypeId,
    subBeadTypeId,
    description: "",
    availabilityStatusCode,
  };
}

describe("selectBuilderCatalogue", () => {
  it("excludes inactive bead types", () => {
    const types = [type("t1", "Crystal", true), type("t2", "Accent", false)];
    const slice = selectBuilderCatalogue({
      beadTypes: types,
      subBeadTypes: [],
      beadLibraries: [bead("b1", "t1"), bead("b2", "t2")],
      catalogAvailabilityStatuses: statuses,
    });
    expect(slice.beadTypes.map((t) => t.id)).toEqual(["t1"]);
    expect(slice.beadLibraries.map((b) => b.id)).toEqual(["b1"]);
  });

  it("excludes sub-types under inactive parent types", () => {
    const types = [type("t1", "Accent", false)];
    const subs = [subType("s1", "t1", "General", true)];
    const slice = selectBuilderCatalogue({
      beadTypes: types,
      subBeadTypes: subs,
      beadLibraries: [bead("b1", "t1", "s1")],
      catalogAvailabilityStatuses: statuses,
    });
    expect(slice.subBeadTypes).toHaveLength(0);
    expect(slice.beadLibraries).toHaveLength(0);
  });

  it("excludes inactive sub-types but keeps active siblings", () => {
    const types = [type("t1", "Crystal", true)];
    const subs = [
      subType("s1", "t1", "General", false),
      subType("s2", "t1", "Quartz", true),
    ];
    const slice = selectBuilderCatalogue({
      beadTypes: types,
      subBeadTypes: subs,
      beadLibraries: [bead("b1", "t1", "s1"), bead("b2", "t1", "s2")],
      catalogAvailabilityStatuses: statuses,
    });
    expect(slice.subBeadTypes.map((s) => s.id)).toEqual(["s2"]);
    expect(slice.beadLibraries.map((b) => b.id)).toEqual(["b2"]);
  });

  it("excludes beads with inactive availability status", () => {
    const types = [type("t1", "Crystal", true)];
    const slice = selectBuilderCatalogue({
      beadTypes: types,
      subBeadTypes: [],
      beadLibraries: [bead("b1", "t1", undefined, "ACTIVE"), bead("b2", "t1", undefined, "INACTIVE")],
      catalogAvailabilityStatuses: statuses,
    });
    expect(slice.beadLibraries.map((b) => b.id)).toEqual(["b1"]);
  });
});
