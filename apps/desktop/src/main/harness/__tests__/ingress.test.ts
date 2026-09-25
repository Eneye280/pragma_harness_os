import { describe, it, expect } from "vitest";
import { MessageIngress } from "../ingress";

describe("MessageIngress — sole entry before agent", () => {
  it("trims and detects commands and mentions", () => {
    const ing = new MessageIngress();
    const { context } = ing.intercept("  /plan agrega auth @backend  ", { workspacePath: "/tmp/ws", sessionId: "s1" });
    expect(context.normalized).toBe("/plan agrega auth @backend");
    expect(context.commands).toEqual(["plan"]);
    expect(context.mentions).toEqual(["backend"]);
    expect(context.sessionId).toBe("s1");
    expect(context.workspaceHash).toHaveLength(12);
  });

  it("creates harness:ingress event", () => {
    const ing = new MessageIngress();
    const { context, eventId } = ing.intercept("hola", { workspacePath: "/tmp/ws2", sessionId: "s2" });
    const ev = ing.createHarnessEvent(context, eventId);
    expect(ev.type).toBe("harness:ingress");
    expect(ev.id).toBe(eventId);
    expect((ev.payload as { message: string }).message).toBe("hola");
    expect(ev.sessionId).toBe("s2");
  });

  it("generates sessionId if not provided", () => {
    const ing = new MessageIngress();
    const { context } = ing.intercept("test", { workspacePath: "/tmp/ws3" });
    expect(context.sessionId).toMatch(/^sess-/);
  });

  it("throws on empty message", () => {
    const ing = new MessageIngress();
    expect(() => ing.intercept("   ", { workspacePath: "/tmp/ws" })).toThrow();
  });

  it("pipeline stub returns 7 stages all pass", async () => {
    const { runPipelineStub } = await import("../pipeline/stub");
    const ing = new MessageIngress();
    const { context } = ing.intercept("agrega OAuth", { workspacePath: "/tmp/ws", sessionId: "s3" });
    const pipeline = await runPipelineStub(context);
    expect(pipeline).toHaveLength(7);
    expect(pipeline.every((p) => p.status === "pass")).toBe(true);
    expect(pipeline[0].stage).toBe("classifier");
  });
});
