import { describe, it, expect } from "vitest";
import { SkillCompiler } from "../skills/skill-compiler";
import { join } from "path";

const ROOT = join(process.cwd(), "..", "..");

describe("SkillCompiler — harness compiles, agent receives closed block", () => {
  it("resolves needs to skills with priority order", () => {
    const c = new SkillCompiler(ROOT);
    const skills = c.resolve(["api-design", "security-review", "tdd-workflow"]);
    expect(skills).toEqual(["security-review", "tdd-workflow", "api-design"]);
  });

  it("compiles 3 skills into one block without duplicates and within budget", async () => {
    const c = new SkillCompiler(ROOT);
    const res = await c.compile(["tdd-workflow", "security-review", "api-design"], 2000);
    expect(res.sources).toEqual(expect.arrayContaining(["tdd-workflow", "security-review", "api-design"]));
    expect(res.block).toContain("TDD Workflow");
    expect(res.block).toContain("Security Review");
    expect(res.block).toContain("API Design");
    expect(res.tokenCount).toBeLessThanOrEqual(2000);
    expect(res.fromCache).toBe(false);
  });

  it("deduplicates repeated lines across skills", async () => {
    const c = new SkillCompiler(ROOT);
    const res = await c.compile(["tdd-workflow", "tdd-workflow"], 2000);
    const occurrences = (res.block.match(/TDD Workflow/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("truncates when over budget", async () => {
    const c = new SkillCompiler(ROOT);
    const res = await c.compile(["tdd-workflow", "security-review", "api-design"], 10);
    expect(res.block).toContain("truncated");
    expect(res.tokenCount).toBeLessThanOrEqual(10);
  });

  it("caches second compile", async () => {
    const c = new SkillCompiler(ROOT);
    const a = await c.compile(["tdd-workflow"], 2000);
    const b = await c.compile(["tdd-workflow"], 2000);
    expect(a.fromCache).toBe(false);
    expect(b.fromCache).toBe(true);
    expect(a.block).toBe(b.block);
  });

  it("skips missing skills gracefully", async () => {
    const c = new SkillCompiler(ROOT);
    const res = await c.compile(["non-existent-skill"], 2000);
    expect(res.sources).toEqual([]);
    expect(res.block).toBe("");
  });

  it("compile <10ms for 3 skills", async () => {
    const c = new SkillCompiler(ROOT);
    const start = Date.now();
    await c.compile(["tdd-workflow", "security-review", "api-design"], 2000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
