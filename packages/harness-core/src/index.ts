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

export interface HarnessEvent {
  id: string;
  type: HarnessEventType;
  payload: unknown;
  ts: number;
  sessionId: string;
}

export const HARNESS_VERSION = "0.1.0";
