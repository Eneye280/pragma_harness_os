import { describe, expect, it } from "vitest";
import { HELP_TOPICS, searchHelp } from "../help";

describe("help center search", () => {
  it("returns all topics for an empty query", () => {
    expect(searchHelp("")).toHaveLength(HELP_TOPICS.length);
  });

  it("finds topics by title, tag and doc", () => {
    expect(searchHelp("sandbox").map((topic) => topic.id)).toContain("sandbox");
    expect(searchHelp("sesiones").map((topic) => topic.id)).toContain("sessions");
    expect(searchHelp("PLUGIN-SDK").map((topic) => topic.id)).toContain("plugins");
  });

  it("matches every token of a multi-word query", () => {
    expect(searchHelp("plan aprobar").map((topic) => topic.id)).toContain("plan");
    expect(searchHelp("docker unicornio")).toHaveLength(0);
  });

  it("every topic has a docs deep-link", () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.doc).toMatch(/^docs\/[\w-]+\.md$/);
    }
  });
});
