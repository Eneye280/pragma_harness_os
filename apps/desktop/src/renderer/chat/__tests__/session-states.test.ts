import { describe, it, expect } from "vitest";
import { INITIAL_CHAT_STATE, sessionStatesReducer, type SessionStates } from "../chat-reducer";

describe("sessionStatesReducer — concurrent sessions", () => {
  it("routes events to their own session and keeps sessions isolated", () => {
    let states: SessionStates = {};
    states = sessionStatesReducer(states, { type: "send", sessionId: "a", id: "a1", text: "tarea A" });
    states = sessionStatesReducer(states, { type: "send", sessionId: "b", id: "b1", text: "tarea B" });

    states = sessionStatesReducer(states, {
      type: "stream",
      event: { kind: "assistant-delta", sessionId: "a", text: "respuesta A" },
    });
    states = sessionStatesReducer(states, {
      type: "stream",
      event: { kind: "assistant-delta", sessionId: "b", text: "respuesta B" },
    });

    expect(states.a.messages.find((message) => message.role === "assistant")?.content).toBe("respuesta A");
    expect(states.b.messages.find((message) => message.role === "assistant")?.content).toBe("respuesta B");
    expect(states.a.agentPhase).toBe("running");
    expect(states.b.agentPhase).toBe("running");
  });

  it("marks only the finished session as done", () => {
    let states: SessionStates = {};
    states = sessionStatesReducer(states, { type: "send", sessionId: "a", id: "a1", text: "A" });
    states = sessionStatesReducer(states, { type: "send", sessionId: "b", id: "b1", text: "B" });
    states = sessionStatesReducer(states, { type: "stream", event: { kind: "assistant-done", sessionId: "a" } });

    expect(states.a.agentPhase).toBe("done");
    expect(states.b.agentPhase).toBe("running");
  });

  it("restores and resets a single session without touching the others", () => {
    let states: SessionStates = { b: { ...INITIAL_CHAT_STATE, agentPhase: "running" } };
    states = sessionStatesReducer(states, {
      type: "restore",
      sessionId: "a",
      state: { messages: [{ id: "m", role: "user", content: "hola", streaming: true }] },
    });
    expect(states.a.messages).toHaveLength(1);
    expect(states.a.messages[0].streaming).toBe(false);

    states = sessionStatesReducer(states, { type: "reset", sessionId: "a" });
    expect(states.a.messages).toHaveLength(0);
    expect(states.b.agentPhase).toBe("running");
  });
});
