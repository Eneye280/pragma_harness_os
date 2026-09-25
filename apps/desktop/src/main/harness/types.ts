export type HarnessEventType =
  | "message"
  | "harness:ingress"
  | "harness:classified"
  | "harness:skills-compiled"
  | "harness:context-assembled"
  | "agent:llm-call"
  | "agent:tool-call"
  | "agent:observation"
  | "harness:gate"
  | "harness:memory-write";

export interface PipelineContext {
  message: string;
  normalized: string;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
  timestamp: number;
  commands: string[];
  mentions: string[];
}

export interface IntentLike {
  domain: string;
  type: string;
  effort: string;
  needs: string[];
}
