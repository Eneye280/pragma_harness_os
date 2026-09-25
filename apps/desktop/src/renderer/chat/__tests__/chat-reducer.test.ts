import { describe, it, expect } from "vitest";
import { INITIAL_CHAT_STATE, chatReducer } from "../chat-reducer";

const SESSION = "sess-1";

describe("Chat reducer", () => {
  it("adds a user message and a streaming assistant placeholder on send", () => {
    const state = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "hola" });
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toMatchObject({ role: "user", content: "hola", streaming: false });
    expect(state.messages[1]).toMatchObject({ role: "assistant", content: "", streaming: true });
    expect(state.agentPhase).toBe("running");
  });

  it("upserts harness steps as they transition running → done", () => {
    const sent = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "hola" });
    const running = chatReducer(sent, {
      type: "stream",
      event: { kind: "harness-step", sessionId: SESSION, phase: "classify", status: "running", label: "clasificando…" },
    });
    const done = chatReducer(running, {
      type: "stream",
      event: { kind: "harness-step", sessionId: SESSION, phase: "classify", status: "done", label: "backend/feature/medium", detail: "0.72" },
    });
    expect(done.steps).toHaveLength(1);
    expect(done.steps[0]).toMatchObject({ phase: "classify", status: "done", label: "backend/feature/medium", detail: "0.72" });
  });

  it("streams assistant deltas and finalizes on done", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "hola" });
    const deltas = ["## Hola\n", "mundo **harness**"];
    for (const text of deltas) {
      state = chatReducer(state, { type: "stream", event: { kind: "assistant-delta", sessionId: SESSION, text } });
    }
    expect(state.messages[1].content).toBe("## Hola\nmundo **harness**");
    expect(state.messages[1].streaming).toBe(true);
    state = chatReducer(state, { type: "stream", event: { kind: "assistant-done", sessionId: SESSION } });
    expect(state.messages[1].streaming).toBe(false);
    expect(state.agentPhase).toBe("done");
  });

  it("tracks a tool call through observation and exposes the diff", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "crea archivo" });
    state = chatReducer(state, {
      type: "stream",
      event: { kind: "tool-call", sessionId: SESSION, callId: "c1", tool: "fileEdit", summary: "fileEdit → a.md", status: "running" },
    });
    expect(state.toolCalls[0]).toMatchObject({ callId: "c1", status: "running" });
    state = chatReducer(state, {
      type: "stream",
      event: { kind: "tool-observation", sessionId: SESSION, callId: "c1", ok: true, output: "wrote a.md", diff: "+ # Nota" },
    });
    expect(state.toolCalls[0]).toMatchObject({ status: "done", ok: true, output: "wrote a.md", diff: "+ # Nota" });
  });

  it("records an error and stops the stream", () => {
    let state = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "hola" });
    state = chatReducer(state, { type: "stream", event: { kind: "error", sessionId: SESSION, message: "provider caído" } });
    expect(state.error).toBe("provider caído");
    expect(state.agentPhase).toBe("done");
    expect(state.messages[1].streaming).toBe(false);
  });

  it("resets the conversation", () => {
    const state = chatReducer(
      chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "hola" }),
      { type: "reset" }
    );
    expect(state).toEqual(INITIAL_CHAT_STATE);
  });

  it("stores a proposed plan and clears it once resolved", () => {
    const plan = {
      sessionId: SESSION,
      title: "Plan — agrega módulo",
      markdown: "# Plan",
      files: ["src/modules/x/index.ts"],
      intent: { domain: "backend", type: "feature", effort: "medium", needs: ["tdd-workflow"] },
      revised: false,
      createdAt: 1,
    };
    let state = chatReducer(INITIAL_CHAT_STATE, { type: "send", id: "m1", text: "agrega módulo" });
    state = chatReducer(state, { type: "stream", event: { kind: "plan-proposed", sessionId: SESSION, plan } });
    expect(state.planStatus).toBe("proposed");
    expect(state.plan?.files).toEqual(["src/modules/x/index.ts"]);
    state = chatReducer(state, { type: "stream", event: { kind: "plan-resolved", sessionId: SESSION, action: "approve" } });
    expect(state.planStatus).toBe("approved");
    expect(state.plan).toBeNull();
  });

  it("stores the live context snapshot emitted by the harness", () => {
    const snapshot = {
      sessionId: SESSION,
      skills: { names: ["tdd-workflow"], sources: ["tdd-workflow"], tokens: 12 },
      rules: { domain: "backend", label: "G1–G10 + backend", tokens: 300 },
      rag: { hits: [{ path: "docs/a.md", score: 0.8, snippet: "auth" }], tokens: 20, indexSize: 4 },
      files: { paths: ["src/a.ts"], tokens: 40 },
      instincts: { items: [], tokens: 0 },
      tokens: { used: 4200, limit: 8000 },
      model: "mock",
      createdAt: 1,
    };
    const state = chatReducer(INITIAL_CHAT_STATE, { type: "stream", event: { kind: "context-assembled", sessionId: SESSION, snapshot } });
    expect(state.context?.tokens.used).toBe(4200);
    expect(state.context?.rag.hits[0].path).toBe("docs/a.md");
  });
});
