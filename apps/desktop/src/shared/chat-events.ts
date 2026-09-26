export type HarnessPhase = "classify" | "plugins" | "rules" | "skills" | "context" | "pre-gates" | "plan" | "agent";

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

export interface UserMessageEvent {
  kind: "user-message";
  sessionId: string;
  text: string;
  steer?: boolean;
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

export interface PlanProposedEvent {
  kind: "plan-proposed";
  sessionId: string;
  plan: import("./plan").PlanProposal;
}

export interface PlanResolvedEvent {
  kind: "plan-resolved";
  sessionId: string;
  action: "approve" | "discard";
}

export interface ContextAssembledEvent {
  kind: "context-assembled";
  sessionId: string;
  snapshot: import("./context-snapshot").HarnessContextSnapshot;
}

export type ChatStreamEvent =
  | HarnessStepEvent
  | AssistantDeltaEvent
  | AssistantDoneEvent
  | UserMessageEvent
  | ToolCallEvent
  | ToolObservationEvent
  | ChatErrorEvent
  | PlanProposedEvent
  | PlanResolvedEvent
  | ContextAssembledEvent;

export interface ChatSendRequest {
  message: string;
  sessionId: string;
  workspacePath: string;
  bypassHarness?: boolean;
  attachments?: import("./attachments").Attachment[];
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
