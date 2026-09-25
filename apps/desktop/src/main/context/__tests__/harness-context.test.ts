import { describe, it, expect } from "vitest";
import { buildHarnessContext, type HarnessContextDeps } from "../harness-context";

function makeDeps(overrides: Partial<HarnessContextDeps> = {}): HarnessContextDeps {
  return {
    ruleEngine: { compile: () => "G1 … G10 rules", getCoreRules: () => ({ G1: "a", G2: "b" }) },
    skillCompiler: {
      resolve: (needs) => needs.map((need) => need),
      compile: async () => ({ block: "skills", sources: ["tdd-workflow"], tokenCount: 10 }),
    },
    rag: {
      ensureIndexed: async () => 3,
      recall: () => [{ path: "docs/auth.md", score: 0.81234, snippet: "auth flow" }],
    },
    vault: { recall: () => [{ trigger: "style", content: "functional", confidence: 0.8 }] },
    assembler: {
      assemble: async () => ({
        finalPrompt: "# SYSTEM — HARNESS COMPILED\nrules\n# USER MESSAGE\nhola harness",
        breakdown: { skills: { tokens: 10, sources: ["tdd-workflow"] }, files: { tokens: 5, paths: ["src/a.ts"] }, totalTokens: 42 },
      }),
    },
    ...overrides,
  };
}

const INPUT = {
  message: "agrega auth",
  intent: { domain: "backend", type: "feature", effort: "medium", needs: ["tdd-workflow", "security-review"], confidence: 0.7 },
  sessionId: "sess-1",
  workspacePath: "/tmp/ws",
  tokenLimit: 8000,
  model: "claude-3-5-sonnet",
};

describe("buildHarnessContext", () => {
  it("builds a snapshot from the real rule, skill, rag, file and instinct sources", async () => {
    const { snapshot, finalPrompt } = await buildHarnessContext(INPUT, makeDeps());
    expect(snapshot.skills.names).toEqual(["tdd-workflow", "security-review"]);
    expect(snapshot.skills.sources).toEqual(["tdd-workflow"]);
    expect(snapshot.rules).toEqual({ domain: "backend", label: "G1–G2 + backend", tokens: expect.any(Number) });
    expect(snapshot.rag.hits).toHaveLength(1);
    expect(snapshot.rag.hits[0].score).toBe(0.812);
    expect(snapshot.rag.indexSize).toBe(3);
    expect(snapshot.files.paths).toEqual(["src/a.ts"]);
    expect(snapshot.instincts.items).toHaveLength(1);
    expect(snapshot.tokens.limit).toBe(8000);
    expect(snapshot.tokens.used).toBeGreaterThan(0);
    expect(snapshot.model).toBe("claude-3-5-sonnet");
    expect(finalPrompt).toContain("HARNESS COMPILED");
  });

  it("degrades gracefully when rag, vault or assembler fail", async () => {
    const deps = makeDeps({
      rag: {
        ensureIndexed: async () => {
          throw new Error("index down");
        },
        recall: () => [],
      },
      vault: {
        recall: () => {
          throw new Error("vault down");
        },
      },
      assembler: {
        assemble: async () => {
          throw new Error("assemble down");
        },
      },
    });
    const { snapshot, finalPrompt } = await buildHarnessContext(INPUT, deps);
    expect(snapshot.rag.hits).toEqual([]);
    expect(snapshot.instincts.items).toEqual([]);
    expect(finalPrompt).toBe("");
    expect(snapshot.tokens.used).toBe(0);
  });
});
