export type HarnessPhase = "classify" | "plugins" | "rules" | "skills" | "context" | "pre-gates" | "agent";

export type HarnessStepStatus = "running" | "done" | "blocked";

export interface HarnessStepEvent {
  kind: "harness-step";
  sessionId: string;
  phase: HarnessPhase;
  status: HarnessStepStatus;
  label: string;
  detail?: string;
}

export interface AssistantDeltaEvent {
  kind: "assistant-delta";
  sessionId: string;
  text: string;
}

export interface AssistantDoneEvent {
  kind: "assistant-done";
  sessionId: string;
}

export interface ToolCallEvent {
  kind: "tool-call";
  sessionId: string;
  callId: string;
  tool: string;
  summary: string;
  status: "running" | "done" | "error";
  diff?: string;
}

export interface ToolObservationEvent {
  kind: "tool-observation";
  sessionId: string;
  callId: string;
  ok: boolean;
  output: string;
  diff?: string;
}

export interface ChatErrorEvent {
  kind: "error";
  sessionId: string;
  message: string;
}

export type ChatStreamEvent =
  | HarnessStepEvent
  | AssistantDeltaEvent
  | AssistantDoneEvent
  | ToolCallEvent
  | ToolObservationEvent
  | ChatErrorEvent;

export interface ChatSendRequest {
  message: string;
  sessionId: string;
  workspacePath: string;
  bypassHarness?: boolean;
}

export const HARNESS_PHASE_ORDER: HarnessPhase[] = [
  "classify",
  "plugins",
  "rules",
  "skills",
  "context",
  "pre-gates",
  "agent",
];
