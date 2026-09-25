import { describe, it, expect } from "vitest";
import { MemoryEventLog } from "../memory-event-log";

describe("EventLog — immutable append-only + replay + timeTravel", () => {
  it("appends and retrieves by session in seq order", () => {
    const log = new MemoryEventLog();
    log.ensureWorkspace("ws-hash-1", "/tmp/ws1");
    const s = "sess-1";
    log.append({ type: "harness:ingress", payload: { msg: "hola" }, sessionId: s, workspaceHash: "ws-hash-1" });
    log.append({ type: "harness:classified", payload: { intent: "feature" }, sessionId: s, workspaceHash: "ws-hash-1" });
    log.append({ type: "agent:llm-call", payload: { model: "deepseek" }, sessionId: s, workspaceHash: "ws-hash-1" });

    const events = log.getBySession(s);
    expect(events).toHaveLength(3);
    expect(events[0].seq).toBe(0);
    expect(events[1].seq).toBe(1);
    expect(events[2].seq).toBe(2);
    expect(events[0].type).toBe("harness:ingress");
  });

  it("replay returns deterministic same order", () => {
    const log = new MemoryEventLog();
    log.ensureWorkspace("ws-hash-2", "/tmp/ws2");
    const s = "sess-2";
    for (let i = 0; i < 5; i++) log.append({ type: "message", payload: { i }, sessionId: s, workspaceHash: "ws-hash-2" });
    const a = log.replay(s);
    const b = log.replay(s);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a).toHaveLength(5);
  });

  it("timeTravel slices up to index inclusive", () => {
    const log = new MemoryEventLog();
    log.ensureWorkspace("ws-hash-3", "/tmp/ws3");
    const s = "sess-3";
    for (let i = 0; i < 4; i++) log.append({ type: "message", payload: { i }, sessionId: s, workspaceHash: "ws-hash-3" });
    const sliced = log.timeTravel(s, 1);
    expect(sliced).toHaveLength(2);
    expect(sliced[1].payload).toEqual({ i: 1 });
    expect(() => log.timeTravel(s, 10)).toThrow();
  });

  it("isolates sessions", () => {
    const log = new MemoryEventLog();
    log.ensureWorkspace("ws-hash-4", "/tmp/ws4");
    log.append({ type: "message", payload: { a: 1 }, sessionId: "s-a", workspaceHash: "ws-hash-4" });
    log.append({ type: "message", payload: { b: 1 }, sessionId: "s-b", workspaceHash: "ws-hash-4" });
    expect(log.getBySession("s-a")).toHaveLength(1);
    expect(log.getBySession("s-b")).toHaveLength(1);
    expect(log.getBySession("s-a")[0].payload).toEqual({ a: 1 });
  });
});
