export interface BenchmarkInput {
  turns: number;
  rulesTokens: number;
  skillsTokens: number;
  avgMessageTokens: number;
  rediscoveryTokensPerTurn: number;
  agentRetention: number[];
}

export interface BenchmarkResult {
  turns: number;
  compiledContextTokens: number;
  harnessFirstTokens: number;
  agentFirstTokens: number;
  tokensSaved: number;
  savingsPct: number;
  retentionAtFourthMessage: { harnessFirst: number; agentFirst: number };
}

export const BENCHMARK_DEFAULTS: BenchmarkInput = {
  turns: 4,
  rulesTokens: 900,
  skillsTokens: 500,
  avgMessageTokens: 60,
  rediscoveryTokensPerTurn: 1800,
  agentRetention: [1, 0.72, 0.55, 0.4],
};

export function benchmarkHarnessFirst(overrides: Partial<BenchmarkInput> = {}): BenchmarkResult {
  const input: BenchmarkInput = { ...BENCHMARK_DEFAULTS, ...overrides };
  const compiledContextTokens = input.rulesTokens + input.skillsTokens;

  let harnessFirstTokens = 0;
  let agentFirstTokens = 0;

  for (let turn = 0; turn < input.turns; turn++) {
    harnessFirstTokens += input.avgMessageTokens + compiledContextTokens;
    agentFirstTokens += input.avgMessageTokens + input.rediscoveryTokensPerTurn;
  }

  const tokensSaved = agentFirstTokens - harnessFirstTokens;
  const savingsPct = agentFirstTokens === 0 ? 0 : Number(((tokensSaved / agentFirstTokens) * 100).toFixed(1));

  return {
    turns: input.turns,
    compiledContextTokens,
    harnessFirstTokens,
    agentFirstTokens,
    tokensSaved,
    savingsPct,
    retentionAtFourthMessage: {
      harnessFirst: 1,
      agentFirst: input.agentRetention[Math.min(3, Math.max(0, input.turns - 1))],
    },
  };
}
