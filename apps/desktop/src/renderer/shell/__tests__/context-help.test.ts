import { describe, expect, it } from "vitest";
import { CONTEXT_HELP, contextSections } from "../context-help";

describe("context section help", () => {
  it("documents every section with a direct description", () => {
    expect(contextSections()).toEqual(Object.keys(CONTEXT_HELP));
    for (const key of contextSections()) {
      expect(CONTEXT_HELP[key].title.length).toBeGreaterThan(0);
      expect(CONTEXT_HELP[key].description.length).toBeGreaterThan(20);
    }
  });

  it("marks the sections that allow authoring as actionable", () => {
    expect(CONTEXT_HELP.skills.action).toBeTruthy();
    expect(CONTEXT_HELP.rag.action).toBeTruthy();
    expect(CONTEXT_HELP.agent.action).toBeTruthy();
  });
});
