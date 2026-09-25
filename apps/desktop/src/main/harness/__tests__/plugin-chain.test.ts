import { describe, it, expect } from "vitest";
import { PluginChain } from "../plugin-chain";

function makeCtx(msg = "hola"): { message: string; normalized: string; sessionId: string; workspaceHash: string; workspacePath: string; timestamp: number } {
  return { message: msg, normalized: msg.trim(), sessionId: "s1", workspaceHash: "ws1", workspacePath: "/tmp/ws", timestamp: Date.now() };
}

describe("PluginChain — middleware pre-agent deterministic", () => {
  it("respects priority order", async () => {
    const chain = new PluginChain();
    const order: string[] = [];
    chain.register({ name: "b", version: "1.0", stage: "pre-agent", priority: 20, hook: async () => { order.push("b"); return { action: "pass" }; } });
    chain.register({ name: "a", version: "1.0", stage: "pre-agent", priority: 10, hook: async () => { order.push("a"); return { action: "pass" }; } });
    chain.register({ name: "c", version: "1.0", stage: "pre-agent", priority: 30, hook: async () => { order.push("c"); return { action: "pass" }; } });
    await chain.run(makeCtx(), "pre-agent");
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("block stops pipeline and returns reason", async () => {
    const chain = new PluginChain();
    chain.register({ name: "secret-scan", version: "1.0", stage: "pre-agent", priority: 10, hook: async (ctx) => (ctx.message.includes("sk-") ? { action: "block", reason: "secret detected" } : { action: "pass" }) });
    chain.register({ name: "other", version: "1.0", stage: "pre-agent", priority: 20, hook: async () => { throw new Error("should not run"); } });
    const res = await chain.run(makeCtx("my key sk-12345"), "pre-agent");
    expect(res.blocked).toEqual({ plugin: "secret-scan", reason: "secret detected" });
    expect(res.executed).toHaveLength(1);
  });

  it("transform modifies message for next plugin", async () => {
    const chain = new PluginChain();
    chain.register({ name: "trimmer", version: "1.0", stage: "pre-agent", priority: 10, hook: async (ctx) => ({ action: "transform", message: ctx.message.toUpperCase() }) });
    let secondSeen = "";
    chain.register({ name: "reader", version: "1.0", stage: "pre-agent", priority: 20, hook: async (ctx) => { secondSeen = ctx.message; return { action: "pass" }; } });
    const res = await chain.run(makeCtx("hello"), "pre-agent");
    expect(res.finalMessage).toBe("HELLO");
    expect(secondSeen).toBe("HELLO");
  });

  it("inject-skill collects skills", async () => {
    const chain = new PluginChain();
    chain.register({ name: "skill-injector", version: "1.0", stage: "pre-compile", priority: 10, hook: async () => ({ action: "inject-skill", skillName: "security-review" }) });
    chain.register({ name: "other-injector", version: "1.0", stage: "pre-compile", priority: 20, hook: async () => ({ action: "inject-skill", skillName: "tdd-workflow" }) });
    const res = await chain.run(makeCtx(), "pre-compile");
    expect(res.injectedSkills).toEqual(["security-review", "tdd-workflow"]);
  });

  it("runAllStages iterates pre-classify -> post-agent and stops on block", async () => {
    const chain = new PluginChain();
    chain.register({ name: "pre-classify-ok", version: "1.0", stage: "pre-classify", priority: 10, hook: async () => ({ action: "pass" }) });
    chain.register({ name: "blocker", version: "1.0", stage: "pre-compile", priority: 10, hook: async () => ({ action: "block", reason: "blocked at compile" }) });
    chain.register({ name: "should-not-run", version: "1.0", stage: "post-agent", priority: 10, hook: async () => ({ action: "pass" }) });
    const res = await chain.runAllStages(makeCtx());
    expect(res.blocked?.reason).toBe("blocked at compile");
    expect(res.executed.map((e) => e.plugin)).toEqual(["pre-classify-ok", "blocker"]);
  });

  it("transform with injectContext collects contexts", async () => {
    const chain = new PluginChain();
    chain.register({ name: "ctx-injector", version: "1.0", stage: "pre-agent", priority: 10, hook: async () => ({ action: "transform", message: "hi", injectContext: "extra context" }) });
    const res = await chain.run(makeCtx("original"), "pre-agent");
    expect(res.injectedContexts).toEqual(["extra context"]);
    expect(res.finalMessage).toBe("hi");
  });
});
