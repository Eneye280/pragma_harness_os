import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { addProjectRule, readProjectRules, removeProjectRule } from "../project-rules";

describe("project rules", () => {
  it("adds, lists and removes rules for a project", () => {
    const dir = mkdtempSync(join(tmpdir(), "phs-rules-"));
    expect(readProjectRules(dir)).toEqual([]);

    const afterAdd = addProjectRule(dir, "usa nombres en español para el dominio");
    expect(afterAdd).toHaveLength(1);
    expect(afterAdd[0].text).toContain("español");
    expect(afterAdd[0].id).toMatch(/^pr-/);

    const withTwo = addProjectRule(dir, "prohíbe console.log en producción");
    expect(withTwo).toHaveLength(2);
    expect(readProjectRules(dir)).toHaveLength(2);

    const afterRemove = removeProjectRule(dir, withTwo[0].id);
    expect(afterRemove).toHaveLength(1);
  });

  it("ignores empty and duplicate rules", () => {
    const dir = mkdtempSync(join(tmpdir(), "phs-rules-"));
    expect(addProjectRule(dir, "   ")).toEqual([]);
    addProjectRule(dir, "regla única");
    expect(addProjectRule(dir, "regla única")).toHaveLength(1);
  });
});
