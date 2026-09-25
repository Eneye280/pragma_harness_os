import { describe, it, expect } from "vitest";
import { ContextAssembler } from "../context-assembler";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

function makeTmpWorkspace(): string {
  const dir = join(tmpdir(), `phs-test-${randomUUID().slice(0, 6)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "src", "modules", "auth"), { recursive: true });
  writeFileSync(join(dir, "src", "modules", "auth", "route.ts"), "export const authRoute = () => {};");
  writeFileSync(join(dir, "README.md"), "# Test WS");
  return dir;
}

describe("ContextAssembler — FinalPrompt closed + budget + prefetch", () => {
  it("assembles with rules + skills + files within budget", async () => {
    const ws = makeTmpWorkspace();
    const assembler = new ContextAssembler();
    const res = await assembler.assemble(
      { message: "agrega auth con OAuth", intent: { domain: "backend", type: "feature", effort: "medium", needs: ["tdd-workflow", "security-review"], confidence: 0.8 }, sessionId: "s1", workspacePath: ws },
      8000
    );
    expect(res.finalPrompt).toContain("HARNESS RULES");
    expect(res.finalPrompt).toContain("TDD Workflow");
    expect(res.finalPrompt).toContain("agrega auth con OAuth");
    expect(res.breakdown.rules.tokens).toBeGreaterThan(0);
    expect(res.breakdown.skills.sources.length).toBeGreaterThan(0);
    expect(res.breakdown.totalTokens).toBeLessThanOrEqual(8000);
  });

  it("truncates history/files when over budget", async () => {
    const ws = makeTmpWorkspace();
    const assembler = new ContextAssembler();
    const longHistory = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `message ${i} `.repeat(200) }));
    const res = await assembler.assemble(
      { message: "hola", intent: { domain: "general", type: "feature", effort: "low", needs: ["tdd-workflow"], confidence: 0.5 }, sessionId: "s2", workspacePath: ws, history: longHistory },
      800
    );
    expect(res.breakdown.totalTokens).toBeLessThanOrEqual(800);
    expect(res.finalPrompt).toContain("hola");
  });

  it("prefetches backend files deterministically", async () => {
    const ws = makeTmpWorkspace();
    const assembler = new ContextAssembler();
    const res = await assembler.assemble(
      { message: "fix auth", intent: { domain: "backend", type: "fix", effort: "low", needs: ["security-review"], confidence: 0.7 }, sessionId: "s3", workspacePath: ws },
      8000
    );
    expect(res.breakdown.files.files).toBeGreaterThan(0);
    expect(res.breakdown.files.paths.some((p) => p.includes("auth"))).toBe(true);
  });

  it("includes rag and instincts when provided", async () => {
    const ws = makeTmpWorkspace();
    const assembler = new ContextAssembler();
    const res = await assembler.assemble(
      {
        message: "test",
        intent: { domain: "general", type: "feature", effort: "low", needs: ["tdd-workflow"], confidence: 0.5 },
        sessionId: "s4",
        workspacePath: ws,
        ragHits: [{ content: "rag hit content about auth", score: 0.9 }],
        instincts: [{ trigger: "when auth", content: "always validate input" }],
      },
      8000
    );
    expect(res.finalPrompt).toContain("rag hit content");
    expect(res.finalPrompt).toContain("always validate input");
    expect(res.breakdown.rag.hits).toBe(1);
    expect(res.breakdown.instincts.count).toBe(1);
  });
});
