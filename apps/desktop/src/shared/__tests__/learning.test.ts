import { describe, expect, it } from "vitest";
import { canAutoApply, createPostmortem, proposeInstincts, summarizePostmortems } from "../learning";

const run = (overrides: Partial<Parameters<typeof createPostmortem>[0]> = {}) =>
  createPostmortem({
    sessionId: "s1",
    goal: "implementar auth",
    outcome: "failed",
    failures: ["faltó typecheck"],
    fixes: ["correr pnpm typecheck antes"],
    lessons: ["verificar gates locales"],
    ...overrides,
  });

describe("self-improvement learning loop", () => {
  it("normalizes and deduplicates postmortems", () => {
    const postmortem = run({ failures: ["a", "a ", ""], fixes: ["x", "x"] });
    expect(postmortem.failures).toEqual(["a"]);
    expect(postmortem.fixes).toEqual(["x"]);
  });

  it("summarizes outcomes and top failures", () => {
    const summary = summarizePostmortems([run(), run({ outcome: "done", failures: [] }), run({ sessionId: "s2" })]);
    expect(summary.total).toBe(3);
    expect(summary.failed).toBe(2);
    expect(summary.done).toBe(1);
    expect(summary.topFailures[0]).toEqual({ failure: "faltó typecheck", count: 2 });
  });

  it("proposes instincts only after repeated failures and never auto-applies", () => {
    expect(proposeInstincts([run()])).toHaveLength(0);
    const proposals = proposeInstincts([run(), run({ sessionId: "s2", goal: "otra" })]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].trigger).toBe("faltó typecheck");
    expect(proposals[0].content).toMatch(/correr pnpm typecheck/);
    expect(proposals[0].evidence).toHaveLength(2);
    expect(proposals[0].autoApply).toBe(false);
    expect(canAutoApply()).toBe(false);
  });
});
