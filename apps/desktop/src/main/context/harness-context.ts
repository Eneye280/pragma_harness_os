import type { HarnessContextSnapshot, InstinctSummary, RagSnippet } from "../../shared/context-snapshot";

export interface HarnessContextIntent {
  domain: string;
  type: string;
  effort: string;
  needs: string[];
  confidence: number;
}

export interface HarnessContextInput {
  message: string;
  intent: HarnessContextIntent;
  sessionId: string;
  workspacePath: string;
  tokenLimit?: number;
  model?: string;
}

interface RawInstinct {
  trigger: string;
  content: string;
  confidence: number;
}

export interface HarnessContextDeps {
  ruleEngine: {
    compile: (intent: { domain: string }, opts?: { maxTokens?: number; includeAgentsMd?: boolean }) => string;
    getCoreRules: () => Record<string, string>;
  };
  skillCompiler: {
    resolve: (needs: string[]) => string[];
    compile: (names: string[], maxTokens?: number) => Promise<{ block: string; sources: string[]; tokenCount: number }>;
  };
  rag: {
    ensureIndexed: () => Promise<number>;
    recall: (query: string, topK?: number) => Array<{ path: string; score: number; snippet: string }>;
  };
  vault: {
    recall: (workspacePath: string, intent?: { domain?: string; needs?: string[] }, minConfidence?: number) => RawInstinct[];
  };
  assembler: {
    assemble: (
      input: {
        message: string;
        intent: HarnessContextIntent;
        sessionId: string;
        workspacePath: string;
        ragHits?: Array<{ content: string; score: number }>;
        instincts?: Array<{ trigger: string; content: string }>;
      },
      budget?: number
    ) => Promise<{
      finalPrompt: string;
      breakdown: { skills: { tokens: number; sources: string[] }; files: { tokens: number; paths: string[] }; totalTokens: number };
    }>;
  };
}

export interface HarnessContextResult {
  snapshot: HarnessContextSnapshot;
  finalPrompt: string;
}

function tokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function buildHarnessContext(input: HarnessContextInput, deps: HarnessContextDeps): Promise<HarnessContextResult> {
  const tokenLimit = input.tokenLimit ?? 8000;

  let indexSize = 0;
  let ragHits: RagSnippet[] = [];
  try {
    indexSize = await deps.rag.ensureIndexed();
    ragHits = deps.rag
      .recall(input.message, 5)
      .map((hit) => ({ path: hit.path, score: Number(hit.score.toFixed(3)), snippet: hit.snippet.slice(0, 240) }));
  } catch {
    ragHits = [];
  }

  const instinctItems: InstinctSummary[] = safeInstincts(deps, input);
  const skillNames = deps.skillCompiler.resolve(input.intent.needs);

  let finalPrompt = "";
  let skillSources: string[] = [];
  let skillTokens = 0;
  let filePaths: string[] = [];
  let fileTokens = 0;

  try {
    const assembled = await deps.assembler.assemble(
      {
        message: input.message,
        intent: input.intent,
        sessionId: input.sessionId,
        workspacePath: input.workspacePath,
        ragHits: ragHits.map((hit) => ({ content: hit.snippet, score: hit.score })),
        instincts: instinctItems.map((item) => ({ trigger: item.trigger, content: item.content })),
      },
      tokenLimit
    );
    finalPrompt = assembled.finalPrompt;
    skillSources = assembled.breakdown.skills.sources;
    skillTokens = assembled.breakdown.skills.tokens;
    filePaths = assembled.breakdown.files.paths;
    fileTokens = assembled.breakdown.files.tokens;
  } catch {
    finalPrompt = "";
  }

  const rulesBlock = deps.ruleEngine.compile({ domain: input.intent.domain }, { maxTokens: 1200, includeAgentsMd: false });
  const coreRuleCount = Object.keys(deps.ruleEngine.getCoreRules()).length;

  const snapshot: HarnessContextSnapshot = {
    sessionId: input.sessionId,
    skills: { names: skillNames, sources: skillSources.length > 0 ? skillSources : skillNames, tokens: skillTokens },
    rules: { domain: input.intent.domain, label: `G1–G${coreRuleCount} + ${input.intent.domain}`, tokens: tokenCount(rulesBlock) },
    rag: { hits: ragHits, tokens: ragHits.reduce((sum, hit) => sum + tokenCount(hit.snippet), 0), indexSize },
    files: { paths: filePaths, tokens: fileTokens },
    instincts: { items: instinctItems, tokens: instinctItems.reduce((sum, item) => sum + tokenCount(item.content), 0) },
    tokens: { used: tokenCount(finalPrompt), limit: tokenLimit },
    model: input.model ?? "executor",
    createdAt: Date.now(),
  };

  return { snapshot, finalPrompt };
}

function safeInstincts(deps: HarnessContextDeps, input: HarnessContextInput): InstinctSummary[] {
  try {
    return deps.vault
      .recall(input.workspacePath, { domain: input.intent.domain, needs: input.intent.needs }, 0.6)
      .map((instinct) => ({ trigger: instinct.trigger, content: instinct.content, confidence: instinct.confidence }));
  } catch {
    return [];
  }
}
