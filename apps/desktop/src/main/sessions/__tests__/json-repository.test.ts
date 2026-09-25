import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { JsonSessionRepository } from "../json-repository";
import { SessionStore } from "../store";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "phs41-json-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeState(text: string): unknown {
  return { messages: [{ id: "m1", role: "user", content: text, streaming: false }], steps: [], toolCalls: [] };
}

describe("JsonSessionRepository", () => {
  it("persists a session to disk and survives a fresh repository instance", () => {
    const store = new SessionStore(new JsonSessionRepository(dir), () => 1000);
    store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state: makeState("hola") });

    const reopened = new SessionStore(new JsonSessionRepository(dir), () => 2000);
    const loaded = reopened.get("s1");
    expect(loaded?.summary.title).toBe("hola");
    expect(loaded?.summary.createdAt).toBe(1000);
    expect(JSON.stringify(loaded?.state)).toContain("hola");
  });

  it("lists sessions for a workspace ordered by recency", () => {
    let clock = 0;
    const store = new SessionStore(new JsonSessionRepository(dir), () => (clock += 100));
    store.save({ id: "a", workspacePath: "/ws", workspaceHash: "h1", state: makeState("a") });
    store.save({ id: "b", workspacePath: "/ws", workspaceHash: "h1", state: makeState("b") });
    store.save({ id: "c", workspacePath: "/other", workspaceHash: "h2", state: makeState("c") });

    const reopened = new SessionStore(new JsonSessionRepository(dir));
    expect(reopened.list("h1").map((session) => session.id)).toEqual(["b", "a"]);
    expect(reopened.latest("h2")?.summary.id).toBe("c");
  });

  it("renames and deletes on disk", () => {
    const repo = new JsonSessionRepository(dir);
    const store = new SessionStore(repo, () => 1000);
    store.save({ id: "s1", workspacePath: "/ws", workspaceHash: "h1", state: makeState("hola") });

    store.rename("s1", "Renombrada");
    expect(store.get("s1")?.summary.title).toBe("Renombrada");
    store.remove("s1");
    expect(new SessionStore(new JsonSessionRepository(dir)).get("s1")).toBeNull();
  });
});
