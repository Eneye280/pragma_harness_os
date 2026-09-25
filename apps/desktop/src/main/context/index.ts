import { ruleEngine } from "../harness/rule-engine";
import { skillCompiler } from "../harness/skills/skill-compiler";
import { ragIndex } from "../harness/rag";
import { contextAssembler } from "../harness/context-assembler";
import { vault } from "../memory/vault";
import { buildHarnessContext, type HarnessContextDeps, type HarnessContextResult } from "./harness-context";

let indexPromise: Promise<number> | null = null;

function ensureRagIndexed(): Promise<number> {
  if (!indexPromise) indexPromise = ragIndex.index().catch(() => 0);
  return indexPromise;
}

export function createHarnessContextDeps(): HarnessContextDeps {
  return {
    ruleEngine,
    skillCompiler,
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
