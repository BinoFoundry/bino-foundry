import { describe, expect, it } from "vitest";

import { bulkDeleteDesignsDto } from "./designs.validation.js";

describe("bulkDeleteDesignsDto", () => {
  it("accepts camelCase designIds and dedupes", () => {
    const parsed = bulkDeleteDesignsDto.parse({
      designIds: ["dsn_a", "dsn_a", " dsn_b "],
    });
    expect(parsed.designIds).toEqual(["dsn_a", "dsn_b"]);
  });

  it("accepts snake_case design_ids", () => {
    const parsed = bulkDeleteDesignsDto.parse({
      design_ids: ["dsn_1", "dsn_2"],
    });
    expect(parsed.designIds).toEqual(["dsn_1", "dsn_2"]);
  });

  it("rejects an empty payload", () => {
    expect(() => bulkDeleteDesignsDto.parse({})).toThrow();
    expect(() => bulkDeleteDesignsDto.parse({ designIds: [] })).toThrow();
  });
});
