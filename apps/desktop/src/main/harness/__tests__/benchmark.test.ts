import { describe, it, expect } from "vitest";
import { BENCHMARK_DEFAULTS, benchmarkHarnessFirst } from "../benchmark";

describe("harness-first benchmark", () => {
  it("projects token savings versus agent-first", () => {
    const result = benchmarkHarnessFirst({ rulesTokens: 900, skillsTokens: 500, avgMessageTokens: 60, rediscoveryTokensPerTurn: 1800, turns: 4 });
    expect(result.compiledContextTokens).toBe(1400);
    expect(result.harnessFirstTokens).toBe(4 * (60 + 1400));
    expect(result.agentFirstTokens).toBe(4 * (60 + 1800));
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.savingsPct).toBeGreaterThan(0);
  });

  it("reports full retention for harness-first and decay for agent-first at the 4th message", () => {
    const result = benchmarkHarnessFirst({ turns: 4 });
    expect(result.retentionAtFourthMessage.harnessFirst).toBe(1);
    expect(result.retentionAtFourthMessage.agentFirst).toBe(BENCHMARK_DEFAULTS.agentRetention[3]);
    expect(result.retentionAtFourthMessage.agentFirst).toBeLessThan(1);
  });

  it("never reports negative savings when rediscovery is cheaper", () => {
    const result = benchmarkHarnessFirst({ rediscoveryTokensPerTurn: 100, turns: 2 });
    expect(result.tokensSaved).toBeLessThan(0);
    expect(result.savingsPct).toBeLessThan(0);
  });
});
