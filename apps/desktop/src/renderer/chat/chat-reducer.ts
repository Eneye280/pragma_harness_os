import type { ChatStreamEvent, HarnessPhase, HarnessStepStatus } from "@shared/chat-events";
import type { HarnessContextSnapshot } from "@shared/context-snapshot";
import type { PlanProposal } from "@shared/plan";
import { markRunState, parseTasks, syncTaskStatuses, type MessageTask } from "@shared/task-list";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  steer?: boolean;
  attachments?: import("@shared/attachments").Attachment[];
  tasks?: MessageTask[];
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
  plan: PlanProposal | null;
  planStatus: "idle" | "proposed" | "approved" | "discarded";
  context: HarnessContextSnapshot | null;
  error: string | null;
}

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  steps: [],
  toolCalls: [],
  agentPhase: "idle",
  plan: null,
  planStatus: "idle",
  context: null,
  error: null,
};

export type ChatAction =
  | { type: "send"; id: string; text: string; attachments?: import("@shared/attachments").Attachment[] }
  | { type: "stream"; event: ChatStreamEvent }
  | { type: "restore"; state: unknown }
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
        messages:
          event.phase === "agent" && event.status === "running"
            ? updateLastAssistant(state.messages, (message) =>
                message.tasks ? { ...message, tasks: markRunState(message.tasks, "running") } : message
              )
            : state.messages,
      };
    case "assistant-delta": {
      const derived = parseTasks(
        (() => {
          const last = [...state.messages].reverse().find((message) => message.role === "assistant");
          return `${last?.content ?? ""}${event.text}`;
        })()
      );
      return {
        ...state,
        messages: updateLastAssistant(state.messages, (message) => {
          const content = message.content + event.text;
          if (derived.length === 0) return { ...message, content };
          const tasks = message.tasks ? syncTaskStatuses(message.tasks, derived) : derived;
          return { ...message, content, tasks };
        }),
      };
    }
    case "assistant-done":
      return {
        ...state,
        agentPhase: "done",
        messages: updateLastAssistant(state.messages, (message) => ({
          ...message,
          streaming: false,
          tasks: message.tasks ? markRunState(message.tasks, "done") : message.tasks,
        })),
      };
    case "user-message":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `steer-${state.messages.length}-${Date.now().toString(36)}`,
            role: "user",
            content: event.text,
            streaming: false,
            steer: event.steer ?? true,
          },
        ],
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
        messages: updateLastAssistant(state.messages, (message) => ({
          ...message,
          streaming: false,
          tasks: message.tasks ? markRunState(message.tasks, "error") : message.tasks,
        })),
      };
    case "plan-proposed":
      return {
        ...state,
        plan: event.plan,
        planStatus: "proposed",
        messages: updateLastAssistant(state.messages, (message) => {
          const derived = parseTasks(event.plan.markdown);
          return derived.length > 0 ? { ...message, tasks: derived } : message;
        }),
      };
    case "plan-resolved":
      return { ...state, plan: null, planStatus: event.action === "approve" ? "approved" : "discarded" };
    case "context-assembled":
      return { ...state, context: event.snapshot };
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, role: "user", content: action.text, streaming: false, attachments: action.attachments },
          { id: `${action.id}-assistant`, role: "assistant", content: "", streaming: true },
        ],
        steps: [],
        toolCalls: [],
        agentPhase: "running",
        plan: null,
        planStatus: "idle",
        context: null,
        error: null,
      };
    case "stream":
      return applyStreamEvent(state, action.event);
    case "restore": {
      const partial = (action.state ?? {}) as Partial<ChatState>;
      return {
        ...INITIAL_CHAT_STATE,
        ...partial,
        messages: Array.isArray(partial.messages) ? partial.messages.map((message) => ({ ...message, streaming: false })) : [],
        steps: Array.isArray(partial.steps) ? partial.steps : [],
        toolCalls: Array.isArray(partial.toolCalls) ? partial.toolCalls : [],
      };
    }
    case "reset":
      return INITIAL_CHAT_STATE;
  }
}

export type SessionStates = Record<string, ChatState>;

export type SessionsAction =
  | { type: "send"; sessionId: string; id: string; text: string; attachments?: import("@shared/attachments").Attachment[] }
  | { type: "stream"; event: ChatStreamEvent }
  | { type: "restore"; sessionId: string; state: unknown }
  | { type: "reset"; sessionId: string }
  | { type: "drop"; sessionId: string };

export function sessionStatesReducer(map: SessionStates, action: SessionsAction): SessionStates {
  switch (action.type) {
    case "send":
      return {
        ...map,
        [action.sessionId]: chatReducer(map[action.sessionId] ?? INITIAL_CHAT_STATE, {
          type: "send",
          id: action.id,
          text: action.text,
          attachments: action.attachments,
        }),
      };
    case "stream": {
      const sessionId = action.event.sessionId;
      return { ...map, [sessionId]: applyStreamEvent(map[sessionId] ?? INITIAL_CHAT_STATE, action.event) };
    }
    case "restore":
      return { ...map, [action.sessionId]: chatReducer(INITIAL_CHAT_STATE, { type: "restore", state: action.state }) };
    case "reset":
      return { ...map, [action.sessionId]: INITIAL_CHAT_STATE };
    case "drop": {
      const next = { ...map };
      delete next[action.sessionId];
      return next;
    }
  }
}
