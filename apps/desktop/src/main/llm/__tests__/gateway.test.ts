import { describe, it, expect } from "vitest";
import { AgentGateway } from "../gateway";

async function* mockResponder(prompt: string) {
  yield `echo: ${prompt.slice(0, 20)}`;
  yield " — done";
}

describe("AgentGateway — only place that calls LLM", () => {
  it("builds messages from finalPrompt", () => {
    const gw = new AgentGateway({ provider: "mock" }, mockResponder);
    const msgs = gw.buildMessages("hello harness");
    expect(msgs).toEqual([{ role: "user", content: "hello harness" }]);
  });

  it("creates call record with model and hash", () => {
    const gw = new AgentGateway({ provider: "deepseek", model: "deepseek-chat" }, mockResponder);
    const call = gw.createCallRecord("test prompt");
    expect(call.model).toBe("deepseek-chat");
    expect(call.promptHash).toHaveLength(8);
    expect(call.messages[0].content).toBe("test prompt");
  });

  it("streams via mock responder", async () => {
    const gw = new AgentGateway({ provider: "mock" }, mockResponder);
    const chunks: string[] = [];
    for await (const c of gw.stream("hello harness prompt")) {
      if (!c.isDone) chunks.push(c.textDelta);
    }
    expect(chunks.join("")).toContain("echo:");
    expect(chunks.join("")).toContain("done");
  });

  it("collects full text", async () => {
    const gw = new AgentGateway({ provider: "mock" }, mockResponder);
    const full = await gw.collect("my prompt for collect");
    expect(full).toContain("echo:");
  });

  it("getModelId respects config", () => {
    const gw = new AgentGateway({ provider: "openai", model: "gpt-4o" });
    expect(gw.getModelId()).toBe("gpt-4o");
    const gw2 = new AgentGateway({ provider: "deepseek" });
    expect(gw2.getModelId()).toBe("deepseek-chat");
  });

  it("setConfig switches provider without code change (BYOK)", () => {
    const gw = new AgentGateway({ provider: "deepseek", model: "deepseek-chat" });
    expect(gw.getModelId()).toBe("deepseek-chat");
    gw.setConfig({ provider: "anthropic", model: "claude-3-5-sonnet-20241022" });
    expect(gw.getModelId()).toBe("claude-3-5-sonnet-20241022");
  });
});
