import { describe, it, expect } from "vitest";
import { MemorySessionRepository } from "../repository";
import { DEFAULT_SESSION_TITLE, SessionStore, countMessages, deriveTitle } from "../store";

function makeState(messages: Array<{ role: string; content: string }>): unknown {
  return { messages: messages.map((message, index) => ({ id: `m${index}`, ...message, streaming: false })), steps: [], toolCalls: [] };
}

describe("deriveTitle", () => {
  it("uses the explicit title first", () => {
    expect(deriveTitle("old", makeState([{ role: "user", content: "hola" }]), "  Mi tarea  ")).toBe("Mi tarea");
  });

  it("derives from the first user message", () => {
    const state = makeState([
      { role: "assistant", content: "listo" },
      { role: "user", content: "  agrega autenticación con licencias que es larga y se corta  " },
    ]);
    expect(deriveTitle(null, state)).toMatch(/^agrega autenticación con licencias/);
  });

  it("falls back to the default title", () => {
    expect(deriveTitle(null, makeState([]))).toBe(DEFAULT_SESSION_TITLE);
  });

  it("keeps an existing meaningful title", () => {
    expect(deriveTitle("Mi sesión", makeState([{ role: "user", content: "otra cosa" }]))).toBe("Mi sesión");
  });
});

describe("SessionStore", () => {
  it("creates a session and derives its title", () => {
    let clock = 1000;
    const store = new SessionStore(new MemorySessionRepository(), () => (clock += 10));
    const summary = store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state: makeState([{ role: "user", content: "haz login" }]) });
    expect(summary.title).toBe("haz login");
    expect(summary.messageCount).toBe(1);
    expect(summary.workspaceHash).toBe("h1");
  });

  it("preserves createdAt on updates but bumps updatedAt", () => {
    let clock = 1000;
    const store = new SessionStore(new MemorySessionRepository(), () => (clock += 10));
    const first = store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state: makeState([{ role: "user", content: "uno" }]) });
    const second = store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state: makeState([{ role: "user", content: "uno" }, { role: "assistant", content: "dos" }]) });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(second.messageCount).toBe(2);
    expect(second.title).toBe("uno");
  });

  it("lists sessions per workspace ordered by recency and returns the latest", () => {
    let clock = 0;
    const store = new SessionStore(new MemorySessionRepository(), () => (clock += 100));
    store.save({ id: "a", workspacePath: "/ws", workspaceHash: "h1", state: makeState([{ role: "user", content: "a" }]) });
    store.save({ id: "b", workspacePath: "/ws", workspaceHash: "h1", state: makeState([{ role: "user", content: "b" }]) });
    store.save({ id: "c", workspacePath: "/other", workspaceHash: "h2", state: makeState([{ role: "user", content: "c" }]) });

    expect(store.list("h1").map((session) => session.id)).toEqual(["b", "a"]);
    expect(store.latest("h1")?.summary.id).toBe("b");
    expect(store.latest("h2")?.summary.id).toBe("c");
  });

  it("round-trips state, renames and deletes", () => {
    const store = new SessionStore(new MemorySessionRepository(), () => 5);
    const state = makeState([{ role: "user", content: "hola" }]);
    store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state });
    expect(store.get("s1")?.state).toEqual(state);

    expect(store.rename("s1", "  Nuevo título  ")?.title).toBe("Nuevo título");
    expect(store.rename("s1", "   ")).toBeNull();

    store.remove("s1");
    expect(store.get("s1")).toBeNull();
  });

  it("counts messages defensively", () => {
    expect(countMessages(undefined)).toBe(0);
    expect(countMessages({ messages: "nope" })).toBe(0);
    expect(countMessages(makeState([{ role: "user", content: "x" }]))).toBe(1);
  });
});
