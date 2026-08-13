import { describe, expect, it } from "vitest";

import { ADMIN_DOC_TOPICS, isAdminDocTopicId, parseAdminDocTopic } from "./admin-doc-topics";
import { getAdminDocSections } from "./admin-doc-content";

describe("admin documentation topics", () => {
  it("lists the editor guide topics", () => {
    expect(ADMIN_DOC_TOPICS.map((t) => t.id)).toContain("strand-render");
    expect(ADMIN_DOC_TOPICS.map((t) => t.id)).toContain("dangling-charms");
    expect(isAdminDocTopicId("frames")).toBe(true);
    expect(parseAdminDocTopic("nope")).toBe("overview");
  });

  it("provides sections for every topic", () => {
    for (const topic of ADMIN_DOC_TOPICS) {
      const sections = getAdminDocSections(topic.id);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0]!.heading.length).toBeGreaterThan(0);
    }
  });
});
