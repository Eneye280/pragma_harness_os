import { describe, it, expect } from "vitest";
import { HARNESS_VERSION, type HarnessEvent, type HarnessEventType } from "../index";

const DETERMINISTIC_EVENT_TYPES: HarnessEventType[] = [
  "harness:ingress",
  "harness:classified",
  "harness:skills-compiled",
  "harness:context-assembled",
  "harness:gate",
  "harness:memory-write",
];

describe("harness-core contract", () => {
  it("exposes the harness version", () => {
    expect(HARNESS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares the deterministic harness event types", () => {
    for (const type of DETERMINISTIC_EVENT_TYPES) {
      expect(type.startsWith("harness:")).toBe(true);
    }
    expect(new Set(DETERMINISTIC_EVENT_TYPES).size).toBe(DETERMINISTIC_EVENT_TYPES.length);
  });

  it("shapes a harness event with id, ts and sessionId", () => {
    const event: HarnessEvent = {
      id: "evt-1",
      type: "harness:classified",
      payload: { domain: "backend" },
      ts: 1,
      sessionId: "sess-1",
    };
    expect(Object.keys(event).sort()).toEqual(["id", "payload", "sessionId", "ts", "type"]);
  });
});
