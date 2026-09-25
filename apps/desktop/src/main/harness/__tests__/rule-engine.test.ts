import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { RuleEngine } from "../rule-engine";

describe("RuleEngine — G1-G10 always injected", () => {
  it("compiles core + style + backend domain", () => {
    const engine = new RuleEngine();
    const block = engine.compile({ domain: "backend" }, { includeAgentsMd: false });
    expect(block).toContain("G1");
    expect(block).toContain("G10");
    expect(block).toContain("Dominio backend");
    expect(block).toContain("Fastify");
    expect(block).toContain("[no-comments-in-body]");
  });

  it("compiles engine domain with vulkan", () => {
    const engine = new RuleEngine();
    const block = engine.compile({ domain: "engine" }, { includeAgentsMd: false });
    expect(block).toContain("Dominio engine");
    expect(block).toContain("Vulkan");
    expect(block).toContain("G1");
  });

  it("compiles unity domain", () => {
    const engine = new RuleEngine();
    const block = engine.compile({ domain: "unity" }, { includeAgentsMd: false });
    expect(block).toContain("Unity");
  });

  it("falls back to general for unknown domain", () => {
    const engine = new RuleEngine();
    const block = engine.compile({ domain: "unknown" }, { includeAgentsMd: false });
    expect(block).toContain("Dominio general");
  });

  it("truncates by token budget", () => {
    const engine = new RuleEngine();
    const block = engine.compile({ domain: "backend" }, { maxTokens: 10, includeAgentsMd: false });
    expect(block).toContain("truncated");
  });

  it("getDomainRule returns correct", () => {
    const engine = new RuleEngine();
    expect(engine.getDomainRule("backend")).toContain("Fastify");
    expect(engine.getDomainRule("engine")).toContain("Vulkan");
    expect(engine.getDomainRule("xxx")).toContain("general");
  });

  it("exposes the raw core and style rule maps", () => {
    const engine = new RuleEngine();
    const coreKeys = Object.keys(engine.getCoreRules());
    expect(coreKeys.some((key) => key.startsWith("G1-"))).toBe(true);
    expect(coreKeys.some((key) => key.startsWith("G10-"))).toBe(true);
    expect(Object.keys(engine.getStyleRules())).toContain("no-comments-in-body");
  });

  it("injects AGENTS.md when present and skips it when disabled", () => {
    const originalCwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), "rule-engine-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Project agents\nFollow the house rules.", "utf8");
    try {
      process.chdir(dir);
      const engine = new RuleEngine();
      const withAgents = engine.compile({ domain: "backend" });
      expect(withAgents).toContain("# AGENTS.md");
      expect(withAgents).toContain("Follow the house rules");

      const withoutAgents = engine.compile({ domain: "backend" }, { includeAgentsMd: false });
      expect(withoutAgents).not.toContain("# AGENTS.md");
    } finally {
      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
