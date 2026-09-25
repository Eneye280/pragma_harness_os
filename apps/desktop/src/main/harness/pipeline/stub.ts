import type { PipelineContext } from "../types";

export interface PipelineStageResult {
  stage: string;
  status: "pass" | "block" | "transform";
  details?: string;
  durationMs: number;
}

export async function runPipelineStub(context: PipelineContext): Promise<PipelineStageResult[]> {
  const stages = ["classifier", "pluginChain", "ruleEngine", "skillCompiler", "contextAssembler", "preGates", "agentGateway"];
  const results: PipelineStageResult[] = [];
  for (const stage of stages) {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 1));
    results.push({ stage, status: "pass", details: `stub pass for ${context.normalized.slice(0, 30)}`, durationMs: Date.now() - start });
  }
  return results;
}
