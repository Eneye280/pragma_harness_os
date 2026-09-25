import { describe, it, expect } from "vitest";
import { join } from "path";
import { SEED_AGENTS } from "../../agents";
import { SkillCompiler } from "../../harness/skills/skill-compiler";
import { STACK_BUNDLES, bundleToProfile, resolveBundle, validateBundle } from "../catalog";

const repoRoot = join(process.cwd(), "..", "..");

function repoSkillNames(): string[] {
  const compiler = new SkillCompiler(repoRoot);
  compiler.useRoots(() => [repoRoot]);
  return compiler.list().map((skill) => skill.name);
}

describe("stack bundles", () => {
  it("defines the five expected stacks", () => {
    expect(STACK_BUNDLES.map((bundle) => bundle.stack)).toEqual(["unity", "engine-vulkan", "unreal", "web", "backend"]);
  });

  it("resolves by stack name case-insensitively", () => {
    expect(resolveBundle("Unity")?.stack).toBe("unity");
    expect(resolveBundle("  backend ")?.stack).toBe("backend");
    expect(resolveBundle("nope")).toBeNull();
  });

  it("every bundle references existing skills and agents", () => {
    const knownAgents = SEED_AGENTS.map((agent) => agent.id);
    const knownSkills = repoSkillNames();
    expect(knownSkills.length).toBeGreaterThan(0);
    for (const bundle of STACK_BUNDLES) {
      const validation = validateBundle(bundle, knownSkills, knownAgents);
      expect(validation, `bundle ${bundle.stack}: ${JSON.stringify(validation)}`).toMatchObject({ ok: true, missingSkills: [], missingAgents: [] });
    }
  });

  it("reports missing references", () => {
    const validation = validateBundle(STACK_BUNDLES[0], [], []);
    expect(validation.ok).toBe(false);
    expect(validation.missingAgents).toContain("unity-gameplay");
  });

  it("applies a bundle to a profile idempotently", () => {
    const unity = resolveBundle("unity")!;
    const first = bundleToProfile(unity, null);
    const second = bundleToProfile(unity, first);
    expect(second).toEqual(first);
    expect(first.agent).toBe("unity-gameplay");
    expect(first.skills).toMatchObject({ "tdd-workflow": true });
    expect(first.gates?.post?.visual).toBe(true);
  });

  it("merges a bundle over an existing profile", () => {
    const backend = resolveBundle("backend")!;
    const current = { name: "my-project", skills: { "custom-lint": false }, gates: { pre: { budget: false } } };
    const merged = bundleToProfile(backend, current);
    expect(merged.name).toBe("my-project");
    expect(merged.skills).toMatchObject({ "custom-lint": false, "api-design": true });
    expect(merged.gates?.pre).toMatchObject({ budget: false, secret: true, schema: true });
  });
});
