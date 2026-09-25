import type { HarnessContextSnapshot } from "../../shared/context-snapshot";
import type { PluginContext } from "./plugin-chain";

export interface SessionMessage {
  message: string;
  sessionId: string;
  workspacePath: string;
  diff?: string;
}

export interface SessionIntent {
  domain: string;
  type: string;
  effort: string;
  needs: string[];
  confidence: number;
}

export interface PipelineStageDeps {
  classify: (message: string, workspacePath: string) => SessionIntent;
  compileContext: (input: {
    message: string;
    intent: SessionIntent;
    sessionId: string;
    workspacePath: string;
    tokenLimit: number;
    model: string;
  }) => Promise<{ snapshot: HarnessContextSnapshot; finalPrompt: string }>;
  runPreAgentPlugins: (context: PluginContext) => Promise<{ blocked?: { plugin: string; reason: string } }>;
  runPostAgentPlugins: (context: PluginContext) => Promise<{ blocked?: { plugin: string; reason: string } }>;
  runPreGates: (input: {
    message: string;
    intent: SessionIntent;
    budget: { tokensUsed: number; tokensLimit: number; costUsedUsd: number; costLimitUsd: number };
  }) => { verdict: "pass" | "block"; blockedBy?: string };
  tokenLimit: number;
  model: string;
}

export interface HarnessStageRecord {
  stage: string;
  output: unknown;
}

export interface HarnessSessionRecord {
  sessionId: string;
  message: string;
  workspacePath: string;
  stages: HarnessStageRecord[];
}

export const DETERMINISTIC_STAGES = ["ingress", "classify", "plugins", "context", "pre-gates", "post-gates"];

export function stripVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "createdAt" || key === "ts" || key === "updatedAt" || key === "timestamp") continue;
      output[key] = stripVolatile(entry);
    }
    return output;
  }
  return value;
}

function buildPluginContext(input: SessionMessage, intent?: SessionIntent): PluginContext {
  return {
    message: input.message,
    normalized: input.message.trim(),
    sessionId: input.sessionId,
    workspaceHash: input.workspacePath,
    workspacePath: input.workspacePath,
    intent,
    timestamp: 0,
    diff: input.diff,
  };
}

export async function runDeterministicPipeline(input: SessionMessage, deps: PipelineStageDeps): Promise<HarnessSessionRecord> {
  const stages: HarnessStageRecord[] = [];
  const normalized = input.message.trim();

  stages.push({
    stage: "ingress",
    output: {
      normalized,
      commands: [...normalized.matchAll(/(^|\s)\/([a-z0-9-]+)/g)].map((match) => match[2]),
      mentions: [...normalized.matchAll(/@([a-z0-9_-]+)/g)].map((match) => match[1]),
    },
  });

  const intent = deps.classify(normalized, input.workspacePath);
  stages.push({ stage: "classify", output: intent });

  const plugins = await deps.runPreAgentPlugins(buildPluginContext(input, intent));
  stages.push({ stage: "plugins", output: plugins });
  if (plugins.blocked) {
    return { sessionId: input.sessionId, message: input.message, workspacePath: input.workspacePath, stages };
  }

  const compiled = await deps.compileContext({
    message: normalized,
    intent,
    sessionId: input.sessionId,
    workspacePath: input.workspacePath,
    tokenLimit: deps.tokenLimit,
    model: deps.model,
  });
  stages.push({ stage: "context", output: stripVolatile(compiled.snapshot) });

  const preGates = deps.runPreGates({
    message: normalized,
    intent,
    budget: { tokensUsed: 0, tokensLimit: deps.tokenLimit, costUsedUsd: 0, costLimitUsd: 100 },
  });
  stages.push({ stage: "pre-gates", output: preGates });
  if (preGates.verdict === "block") {
    return { sessionId: input.sessionId, message: input.message, workspacePath: input.workspacePath, stages };
  }

  const postGates = await deps.runPostAgentPlugins(buildPluginContext(input, intent));
  stages.push({ stage: "post-gates", output: postGates });

  return { sessionId: input.sessionId, message: input.message, workspacePath: input.workspacePath, stages };
}

export function compareRecords(
  original: HarnessSessionRecord,
  replayed: HarnessSessionRecord
): { identical: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  const originalStages = new Map(original.stages.map((stage) => [stage.stage, stage.output]));
  const replayedStages = new Map(replayed.stages.map((stage) => [stage.stage, stage.output]));

  for (const stage of DETERMINISTIC_STAGES) {
    const hadOriginal = originalStages.has(stage);
    const hadReplay = replayedStages.has(stage);
    if (!hadOriginal && !hadReplay) continue;
    if (hadOriginal !== hadReplay) {
      mismatches.push(stage);
      continue;
    }
    const left = JSON.stringify(stripVolatile(originalStages.get(stage)));
    const right = JSON.stringify(stripVolatile(replayedStages.get(stage)));
    if (left !== right) mismatches.push(stage);
  }

  return { identical: mismatches.length === 0, mismatches };
}

export async function replayDeterministic(
  record: HarnessSessionRecord,
  deps: PipelineStageDeps
): Promise<{ replayed: HarnessSessionRecord; identical: boolean; mismatches: string[] }> {
  const replayed = await runDeterministicPipeline(
    { message: record.message, sessionId: record.sessionId, workspacePath: record.workspacePath },
    deps
  );
  const comparison = compareRecords(record, replayed);
  return { replayed, ...comparison };
}

export function timeTravel<T>(events: T[], index: number): T[] {
  if (index < 0 || index >= events.length) throw new Error(`timeTravel: index ${index} out of bounds (0..${events.length - 1})`);
  return events.slice(0, index + 1);
}
