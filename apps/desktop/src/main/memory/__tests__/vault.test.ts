import { describe, it, expect, beforeEach } from "vitest";
import { MemoryVault } from "../vault";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("MemoryVault — MemFS + instincts confidence", () => {
  let vault: MemoryVault;
  let root: string;
  let ws: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vault-test-"));
    vault = new MemoryVault(root);
    ws = "/tmp/ws-test-" + Math.random().toString(36).slice(2, 6);
  });

  it("creates instinct with 0.5 and increments to >0.7 after 3 corrections", () => {
    let inst = vault.addInstinct(ws, { trigger: "when auth", content: "always validate input", domain: "backend", evidence: "correction 1" });
    expect(inst.confidence).toBe(0.5);
    inst = vault.addInstinct(ws, { trigger: "when auth", content: "always validate input v2", evidence: "correction 2" });
    expect(inst.confidence).toBeCloseTo(0.62, 1);
    inst = vault.addInstinct(ws, { trigger: "when auth", content: "always validate input v3", evidence: "correction 3" });
    expect(inst.confidence).toBeGreaterThan(0.7);
    expect(inst.count).toBe(3);
    expect(inst.evidence).toHaveLength(3);
  });

  it("recall filters by minConfidence and domain", () => {
    vault.addInstinct(ws, { trigger: "when auth", content: "validate", domain: "backend" });
    vault.addInstinct(ws, { trigger: "when vulkan", content: "check gpu", domain: "engine" });
    let hits = vault.recall(ws, { domain: "backend" }, 0.6);
    expect(hits).toHaveLength(0);
    vault.addInstinct(ws, { trigger: "when auth", content: "validate v2", domain: "backend" });
    vault.addInstinct(ws, { trigger: "when auth", content: "validate v3", domain: "backend" });
    hits = vault.recall(ws, { domain: "backend" }, 0.6);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].domain).toBe("backend");
  });

  it("contradict lowers confidence", () => {
    vault.addInstinct(ws, { trigger: "when test", content: "use tdd", domain: "general" });
    vault.addInstinct(ws, { trigger: "when test", content: "use tdd v2" });
    const before = vault.listInstincts(ws)[0].confidence;
    const after = vault.contradict(ws, "when test")!;
    expect(after.confidence).toBeLessThan(before);
  });

  it("persists to disk and reloads", () => {
    vault.addInstinct(ws, { trigger: "persist", content: "hello", domain: "general" });
    const vault2 = new MemoryVault(root);
    const list = vault2.listInstincts(ws);
    expect(list).toHaveLength(1);
    expect(list[0].trigger).toBe("persist");
  });

  it("clear removes all", () => {
    vault.addInstinct(ws, { trigger: "a", content: "x" });
    vault.addInstinct(ws, { trigger: "b", content: "y" });
    vault.clear(ws);
    expect(vault.listInstincts(ws)).toHaveLength(0);
  });
});
