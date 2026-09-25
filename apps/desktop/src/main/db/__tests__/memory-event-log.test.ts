import { describe, it, expect } from "vitest";
import { MemoryEventLog } from "../memory-event-log";

describe("MemoryEventLog.allEvents", () => {
  it("returns every appended event in chronological order", () => {
    const log = new MemoryEventLog();
    log.ensureWorkspace("hash", "/ws");
    log.append({ type: "message", payload: { text: "a" }, sessionId: "s1", workspaceHash: "hash", ts: 1 });
    log.append({ type: "harness:memory-write", payload: { kind: "correction" }, sessionId: "s2", workspaceHash: "hash", ts: 2 });
    const all = log.allEvents();
    expect(all).toHaveLength(2);
    expect(all.map((event) => event.ts)).toEqual([1, 2]);
    expect(all[1].type).toBe("harness:memory-write");
  });
});
