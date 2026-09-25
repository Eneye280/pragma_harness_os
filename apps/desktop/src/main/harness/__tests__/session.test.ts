import { describe, it, expect } from "vitest";
import { compareRecords, replayDeterministic, runDeterministicPipeline, timeTravel, type PipelineStageDeps } from "../session";

function makeDeps(overrides: Partial<PipelineStageDeps> = {}): PipelineStageDeps {
  return {
    classify: () => ({ domain: "backend", type: "feature", effort: "medium", needs: ["tdd-workflow"], confidence: 0.8 }),
    compileContext: async (input) => ({
      snapshot: {
        sessionId: input.sessionId,
        skills: { names: input.intent.needs, sources: input.intent.needs, tokens: 120 },
        rules: { domain: input.intent.domain, label: "G1–G10 + backend", tokens: 900 },
        rag: { hits: [], tokens: 0, indexSize: 3 },
        files: { paths: [], tokens: 0 },
        instincts: { items: [], tokens: 0 },
        tokens: { used: 1100, limit: input.tokenLimit },
        model: input.model,
        createdAt: Date.now(),
      },
      finalPrompt: "# SYSTEM\n...",
    }),
    runPreAgentPlugins: async () => ({}),
    runPostAgentPlugins: async () => ({}),
    runPreGates: () => ({ verdict: "pass" }),
    tokenLimit: 8000,
    model: "mock",
    ...overrides,
  };
}

const INPUT = { message: "agrega un endpoint /users", sessionId: "sess-1", workspacePath: "/ws" };

describe("deterministic harness session", () => {
  it("records the deterministic stages in order", async () => {
    const record = await runDeterministicPipeline(INPUT, makeDeps());
    expect(record.stages.map((stage) => stage.stage)).toEqual([
      "ingress",
      "classify",
      "plugins",
      "context",
      "pre-gates",
      "post-gates",
    ]);
    expect(record.stages.find((stage) => stage.stage === "ingress")?.output).toMatchObject({ normalized: "agrega un endpoint /users" });
  });

  it("replays identically without any LLM call (timestamps ignored)", async () => {
    const deps = makeDeps();
    const original = await runDeterministicPipeline(INPUT, deps);
    const { identical, mismatches, replayed } = await replayDeterministic(original, deps);
    expect(mismatches).toEqual([]);
    expect(identical).toBe(true);
    expect(replayed.stages).toHaveLength(original.stages.length);
  });

  it("detects a divergence in a deterministic stage", async () => {
    const original = await runDeterministicPipeline(INPUT, makeDeps());
    const replayed = await runDeterministicPipeline(
      INPUT,
      makeDeps({ classify: () => ({ domain: "engine", type: "feature", effort: "medium", needs: [], confidence: 0.5 }) })
    );
    const comparison = compareRecords(original, replayed);
    expect(comparison.identical).toBe(false);
    expect(comparison.mismatches).toContain("classify");
    expect(comparison.mismatches).toContain("context");
  });

  it("stops at a pre-agent plugin block", async () => {
    const record = await runDeterministicPipeline(
      INPUT,
      makeDeps({ runPreAgentPlugins: async () => ({ blocked: { plugin: "secret-scan", reason: "secreto" } }) })
    );
    expect(record.stages.map((stage) => stage.stage)).toEqual(["ingress", "classify", "plugins"]);
  });

  it("timeTravel returns the prefix up to index and validates bounds", () => {
    const events = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(timeTravel(events, 1)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(() => timeTravel(events, 5)).toThrow(/out of bounds/);
  });
});
