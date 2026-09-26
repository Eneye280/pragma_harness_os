import { describe, expect, it } from "vitest";
import { defaultSkillBody, needsFromTriggers, parseSkillDoc, serializeSkillDoc, validateSkillDoc } from "../skill-authoring";

const VALID = serializeSkillDoc(
  { name: "spike-notes", description: "Notas de spike con evidencia", triggers: ["spike", "experimento"], needs: ["tdd-workflow"], priority: 4 },
  defaultSkillBody()
);

describe("skill-authoring", () => {
  it("round-trips frontmatter and body", () => {
    const parsed = parseSkillDoc(VALID);
    expect(parsed.frontmatter).toMatchObject({ name: "spike-notes", priority: 4 });
    expect(parsed.frontmatter.triggers).toEqual(["spike", "experimento"]);
    expect(parsed.frontmatter.needs).toEqual(["tdd-workflow"]);
    expect(parsed.body).toContain("## When to use");
  });

  it("validates a complete skill", () => {
    const result = validateSkillDoc(VALID);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects missing frontmatter fields and bad names", () => {
    const result = validateSkillDoc("---\nname: Bad Name\ndescription: \ntriggers: []\n---\n\nbody");
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(["falta el campo description", "define al menos un trigger"]));
    expect(result.errors.some((error) => error.includes("kebab-case"))).toBe(true);
  });

  it("warns about missing sections and unknown needs", () => {
    const result = validateSkillDoc("---\nname: a\ndescription: b\ntriggers: [x]\nneeds: [made-up]\n---\n\nno sections");
    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("made-up"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("When to use"))).toBe(true);
  });

  it("maps triggers to known needs", () => {
    expect(needsFromTriggers(["api", "api-design", "Spike"])).toEqual(["api-design"]);
  });
});
