import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SkillCatalog, parseFrontmatter } from "../catalog";
import { SkillCompiler } from "../skill-compiler";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "phs38-"));
  roots.push(root);
  return root;
}

function writeSkill(root: string, name: string, frontmatter: string, body = "# Skill\n\n## Procedure\n1. paso\n"): void {
  const dir = join(root, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`, "utf8");
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe("parseFrontmatter", () => {
  it("parses name, description, triggers and priority", () => {
    const meta = parseFrontmatter("---\nname: api\ndescription: REST\ntriggers: [api, endpoint]\npriority: 5\n---\n# x");
    expect(meta).toEqual({ name: "api", description: "REST", triggers: ["api", "endpoint"], priority: 5 });
  });

  it("returns empty when there is no frontmatter", () => {
    expect(parseFrontmatter("# just markdown")).toEqual({});
  });
});

describe("SkillCatalog", () => {
  it("discovers skills and dedupes by name with the first root winning", () => {
    const primary = makeRoot();
    const secondary = makeRoot();
    writeSkill(primary, "shared", "name: shared\ndescription: primary", "");
    writeSkill(secondary, "shared", "name: shared\ndescription: secondary", "");
    writeSkill(secondary, "only-secondary", "name: only-secondary", "");

    const catalog = new SkillCatalog(() => [primary, secondary]);
    const entries = catalog.scan();
    expect(entries.map((entry) => entry.name)).toEqual(["only-secondary", "shared"]);
    expect(entries.find((entry) => entry.name === "shared")?.description).toBe("primary");
  });
});

describe("SkillCompiler at scale", () => {
  let root: string;

  beforeEach(() => {
    root = makeRoot();
    for (let index = 0; index < 100; index += 1) {
      const name = `skill-${String(index).padStart(3, "0")}`;
      writeSkill(root, name, `name: ${name}\ndescription: synthetic ${index}\ntriggers: [trigger-${index}]\npriority: ${index}`, `# ${name}\n\n## Rules\n- rule ${index}\n`);
    }
  });

  it("lists all 100 synthetic skills", () => {
    const compiler = new SkillCompiler(root);
    compiler.useRoots(() => [root]);
    expect(compiler.list()).toHaveLength(100);
  });

  it("resolves only the relevant skills and caps the count", () => {
    const compiler = new SkillCompiler(root);
    compiler.useRoots(() => [root]);
    compiler.useEnabled(() => ({}));

    expect(compiler.resolve(["skill-042"])).toEqual(["skill-042"]);
    expect(compiler.resolve(["skill-042", "skill-007"])).toEqual(["skill-007", "skill-042"]);

    const many = Array.from({ length: 20 }, (_value, index) => `skill-${String(index).padStart(3, "0")}`);
    expect(compiler.resolve(many)).toHaveLength(6);
  });

  it("respects the disabled set", () => {
    const compiler = new SkillCompiler(root);
    compiler.useRoots(() => [root]);
    compiler.useEnabled(() => ({ "skill-042": false, "skill-007": false }));
    expect(compiler.resolve(["skill-042", "skill-007", "skill-010"])).toEqual(["skill-010"]);
    expect(compiler.list().find((skill) => skill.name === "skill-042")?.enabled).toBe(false);
  });

  it("compiles relevant skills within the token budget", async () => {
    const compiler = new SkillCompiler(root);
    compiler.useRoots(() => [root]);
    const resolved = compiler.resolve(["skill-042", "skill-007"]);
    const compiled = await compiler.compile(resolved, 40);
    expect(compiled.sources).toEqual(resolved);
    expect(compiled.tokenCount).toBeLessThanOrEqual(40);
  });
});
