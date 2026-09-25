import { describe, it, expect } from "vitest";
import { join } from "path";
import { classify } from "../classifier";
import { SkillCompiler } from "../skills/skill-compiler";

const ROOT = join(process.cwd(), "..", "..");

describe("seed skills — native harness format", () => {
  it("compiles tdd-workflow + api-design into one block for a feature api intent", async () => {
    const intent = classify("agrega un endpoint api /users");
    expect(intent.type).toBe("feature");
    expect(intent.needs).toEqual(expect.arrayContaining(["tdd-workflow", "api-design"]));

    const compiler = new SkillCompiler(ROOT);
    const skills = compiler.resolve(intent.needs);
    expect(skills).toEqual(expect.arrayContaining(["tdd-workflow", "api-design"]));

    const result = await compiler.compile(skills, 2000);
    expect(result.sources).toEqual(expect.arrayContaining(["tdd-workflow", "api-design"]));
    expect(result.block).toContain("TDD Workflow");
    expect(result.block).toContain("API Design");
    expect(result.tokenCount).toBeLessThanOrEqual(2000);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("keeps the RED/GREEN/REFACTOR and coverage contract in tdd-workflow", async () => {
    const result = await new SkillCompiler(ROOT).compile(["tdd-workflow"], 2000);
    expect(result.block).toContain("RED");
    expect(result.block).toContain("GREEN");
    expect(result.block).toContain("REFACTOR");
    expect(result.block).toContain("80%");
  });

  it("keeps the OWASP/Zod contract in security-review", async () => {
    const result = await new SkillCompiler(ROOT).compile(["security-review"], 2000);
    expect(result.block).toContain("OWASP");
    expect(result.block).toContain("Zod");
  });

  it("keeps the REST/Zod/pagination contract in api-design", async () => {
    const result = await new SkillCompiler(ROOT).compile(["api-design"], 2000);
    expect(result.block).toContain("Zod");
    expect(result.block).toContain("Paginación");
  });

  it("ships a template skill for new ones", async () => {
    const result = await new SkillCompiler(ROOT).compile(["_template"], 2000);
    expect(result.sources).toEqual(["_template"]);
    expect(result.block).toContain("When to use");
  });
});
