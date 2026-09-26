import { ruleEngine } from "../harness/rule-engine";
import { skillCompiler } from "../harness/skills/skill-compiler";
import { ragIndex } from "../harness/rag";
import { contextAssembler } from "../harness/context-assembler";
import { vault } from "../memory/vault";
import { buildHarnessContext, type HarnessContextDeps, type HarnessContextResult } from "./harness-context";

let indexPromise: Promise<number> | null = null;
let agentProvider: ((domain: string) => { id: string; name: string; prompt: string; skills: string[] } | null) | null = null;
let ragExcludesProvider: (() => string[]) | null = null;

export function configureRagExcludes(provider: () => string[]): void {
  ragExcludesProvider = provider;
}

function ensureRagIndexed(): Promise<number> {
  if (!indexPromise) {
    const excludes = ragExcludesProvider?.() ?? [];
    if (excludes.length > 0) ragIndex.setExcludes(excludes);
    indexPromise = ragIndex.index().catch(() => 0);
  }
  return indexPromise;
}

export function configureAgentProvider(
  provider: (domain: string) => { id: string; name: string; prompt: string; skills: string[] } | null
): void {
  agentProvider = provider;
}

export function createHarnessContextDeps(): HarnessContextDeps {
  return {
    ruleEngine,
    skillCompiler,
    agentProvider: (domain) => agentProvider?.(domain) ?? null,
    rag: {
      ensureIndexed: ensureRagIndexed,
      recall: (query, topK) => ragIndex.recall(query, topK),
    },
    vault,
    assembler: contextAssembler,
  };
}

export async function compileHarnessContext(
  input: Parameters<typeof buildHarnessContext>[0],
  deps: HarnessContextDeps = createHarnessContextDeps()
): Promise<HarnessContextResult> {
  return buildHarnessContext(input, deps);
}

export { buildHarnessContext } from "./harness-context";
export type { HarnessContextDeps, HarnessContextInput, HarnessContextIntent, HarnessContextResult } from "./harness-context";
