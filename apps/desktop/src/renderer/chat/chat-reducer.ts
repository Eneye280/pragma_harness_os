import type { ChatStreamEvent, HarnessPhase, HarnessStepStatus } from "@shared/chat-events";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}

export interface HarnessStepState {
  phase: HarnessPhase;
  status: HarnessStepStatus;
  label: string;
  detail?: string;
}

export interface ToolCallState {
  callId: string;
  tool: string;
  summary: string;
  status: "running" | "done" | "error";
  diff?: string;
  output?: string;
  ok?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  steps: HarnessStepState[];
  toolCalls: ToolCallState[];
  agentPhase: "idle" | "running" | "done";
  error: string | null;
}

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  steps: [],
  toolCalls: [],
  agentPhase: "idle",
  error: null,
};

export type ChatAction =
  | { type: "send"; id: string; text: string }
  | { type: "stream"; event: ChatStreamEvent }
  | { type: "reset" };

function upsertStep(steps: HarnessStepState[], next: HarnessStepState): HarnessStepState[] {
  const existingIndex = steps.findIndex((step) => step.phase === next.phase);
  if (existingIndex === -1) return [...steps, next];
  const updated = [...steps];
  updated[existingIndex] = next;
  return updated;
}

function updateLastAssistant(
  messages: ChatMessage[],
  updater: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") {
      const updated = [...messages];
      updated[index] = updater(messages[index]);
      return updated;
    }
  }
  return messages;
}

function applyStreamEvent(state: ChatState, event: ChatStreamEvent): ChatState {
  switch (event.kind) {
    case "harness-step":
      return {
        ...state,
        steps: upsertStep(state.steps, {
          phase: event.phase,
          status: event.status,
          label: event.label,
          detail: event.detail,
        }),
      };
    case "assistant-delta":
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (message) => ({
          ...message,
          content: message.content + event.text,
        })),
      };
    case "assistant-done":
      return {
        ...state,
        agentPhase: "done",
        messages: updateLastAssistant(state.messages, (message) => ({ ...message, streaming: false })),
      };
    case "tool-call": {
      const existing = state.toolCalls.find((call) => call.callId === event.callId);
      const nextCall: ToolCallState = existing
        ? { ...existing, status: event.status, summary: event.summary, diff: event.diff ?? existing.diff }
        : { callId: event.callId, tool: event.tool, summary: event.summary, status: event.status, diff: event.diff };
      const toolCalls = existing
        ? state.toolCalls.map((call) => (call.callId === event.callId ? nextCall : call))
        : [...state.toolCalls, nextCall];
      return { ...state, toolCalls };
    }
    case "tool-observation":
      return {
        ...state,
        toolCalls: state.toolCalls.map((call) =>
          call.callId === event.callId
            ? { ...call, status: event.ok ? "done" : "error", ok: event.ok, output: event.output, diff: event.diff ?? call.diff }
            : call
        ),
      };
    case "error":
      return {
        ...state,
        error: event.message,
        agentPhase: "done",
        messages: updateLastAssistant(state.messages, (message) => ({ ...message, streaming: false })),
      };
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, role: "user", content: action.text, streaming: false },
          { id: `${action.id}-assistant`, role: "assistant", content: "", streaming: true },
        ],
        steps: [],
        toolCalls: [],
        agentPhase: "running",
        error: null,
      };
    case "stream":
      return applyStreamEvent(state, action.event);
    case "reset":
      return INITIAL_CHAT_STATE;
  }
}
