import { describe, it, expect } from "vitest";
import { ChatService, buildAgentPrompt } from "../chat-service";
import type { ChatStreamEvent } from "../../../shared/chat-events";
import type { ToolObservation, ToolRunner } from "../../tools";

async function* streamChunks(chunks: string[]) {
  for (const chunk of chunks) yield { textDelta: chunk, isDone: false };
  yield { textDelta: "", isDone: true };
}

function makeRunner(observation: Partial<ToolObservation>): ToolRunner {
  return {
    execute: async () => ({
      callId: "c1",
      tool: "fileEdit" as const,
      ok: true,
      output: "wrote harness-note.md",
      diffPreview: "+ # Nota",
      durationMs: 1,
      ts: 0,
      ...observation,
    }),
  } as unknown as ToolRunner;
}

function runService(chunks: string[], runner = makeRunner({}), bypassHarness = false) {
  const events: ChatStreamEvent[] = [];
  const service = new ChatService({
    gateway: { stream: () => streamChunks(chunks) },
    toolRunner: runner,
    toolWorkspacePath: "/tmp/ws",
  });
  return service
    .run({ message: "crea un archivo de nota", sessionId: "sess-1", workspacePath: "/tmp/repo", bypassHarness }, (event) =>
      events.push(event),
    )
    .then(() => events);
}

describe("ChatService", () => {
  it("emits harness steps, streamed deltas and completion", async () => {
    const events = await runService(["## Hola\n", "mundo"]);
    const kinds = events.map((event) => event.kind);
    expect(kinds[0]).toBe("harness-step");
    expect(events.filter((event) => event.kind === "assistant-delta")).toHaveLength(2);
    expect(kinds[kinds.length - 1]).toBe("harness-step");
    const phases = events.filter((event) => event.kind === "harness-step").map((event) => (event as { phase: string }).phase);
    expect(phases).toEqual(["classify", "classify", "plugins", "rules", "skills", "context", "pre-gates", "agent", "agent"]);
  });

  it("executes a tool call when the model emits a tool block", async () => {
    const toolBlock = '```tool\n{"tool":"fileEdit","args":{"path":"harness-note.md","content":"# Nota"}}\n```';
    const events = await runService(["Escribo el archivo\n", toolBlock]);
    const toolCall = events.find((event) => event.kind === "tool-call");
    const observation = events.find((event) => event.kind === "tool-observation");
    expect(toolCall).toMatchObject({ tool: "fileEdit", status: "running" });
    expect(observation).toMatchObject({ ok: true, diff: "+ # Nota", output: "wrote harness-note.md" });
  });

  it("skips harness phases when bypass is requested but still streams to the agent", async () => {
    const events = await runService(["respuesta"], makeRunner({}), true);
    const phases = events.filter((event) => event.kind === "harness-step").map((event) => (event as { phase: string }).phase);
    expect(phases).toEqual(["agent", "agent"]);
    expect(events.some((event) => event.kind === "assistant-delta")).toBe(true);
  });

  it("reports a gateway failure as an error event", async () => {
    const events: ChatStreamEvent[] = [];
    const service = new ChatService({
      gateway: {
        // eslint-disable-next-line require-yield
        stream: async function* () {
          throw new Error("provider caído");
        },
      },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
    });
    await service.run({ message: "hola", sessionId: "sess-1", workspacePath: "/tmp/repo" }, (event) => events.push(event));
    expect(events.find((event) => event.kind === "error")).toMatchObject({ message: "provider caído" });
  });

  it("builds the agent prompt with harness preamble and needs", () => {
    const prompt = buildAgentPrompt({ message: "agrega auth", sessionId: "s", workspacePath: "/w" }, ["tdd-workflow", "security-review"]);
    expect(prompt).toContain("[harness]");
    expect(prompt).toContain("needs=tdd-workflow,security-review");
    expect(prompt).toContain("agrega auth");
  });

  it("proposes a plan and waits for approval before executing", async () => {
    const events: ChatStreamEvent[] = [];
    let proposedFiles = 0;
    const planGate = {
      propose: async (plan: { files: string[]; sessionId: string }, emit: (event: ChatStreamEvent) => void) => {
        proposedFiles = plan.files.length;
        emit({ kind: "plan-proposed", sessionId: plan.sessionId, plan: plan as never });
        return { action: "approve" as const, markdown: "# Plan editado por el usuario" };
      },
    };
    const service = new ChatService({
      gateway: { stream: () => streamChunks(["ejecutando"]) },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
      planGate,
    });
    await service.run({ message: "agrega un módulo de reportes", sessionId: "sess-1", workspacePath: "/tmp/repo" }, (event) =>
      events.push(event),
    );
    expect(proposedFiles).toBeGreaterThan(0);
    expect(events.some((event) => event.kind === "plan-proposed")).toBe(true);
    expect(events.find((event) => event.kind === "assistant-delta")).toMatchObject({ text: "ejecutando" });
    expect(events.some((event) => event.kind === "plan-resolved")).toBe(false);
  });

  it("emits the compiled context snapshot and feeds the assembled prompt to the agent", async () => {
    const events: ChatStreamEvent[] = [];
    let seenPrompt = "";
    const service = new ChatService({
      gateway: {
        stream: (prompt: string) => {
          seenPrompt = prompt;
          return streamChunks(["ok"]);
        },
      },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
      contextCompiler: async () => ({
        snapshot: {
          sessionId: "s",
          skills: { names: ["tdd-workflow"], sources: ["tdd-workflow"], tokens: 1 },
          rules: { domain: "general", label: "G1–G10 + general", tokens: 1 },
          rag: { hits: [], tokens: 0, indexSize: 0 },
          files: { paths: [], tokens: 0 },
          instincts: { items: [], tokens: 0 },
          tokens: { used: 12, limit: 8000 },
          model: "mock",
          createdAt: 0,
        },
        finalPrompt: "COMPILED PROMPT",
      }),
    });
    await service.run({ message: "hola", sessionId: "s", workspacePath: "/w" }, (event) => events.push(event));
    expect(events.some((event) => event.kind === "context-assembled")).toBe(true);
    expect(seenPrompt).toBe("COMPILED PROMPT");
  });

  it("stops without calling the agent when the plan is discarded", async () => {
    const events: ChatStreamEvent[] = [];
    let gatewayUsed = false;
    const service = new ChatService({
      gateway: {
        stream: () => {
          gatewayUsed = true;
          return streamChunks(["no debería ejecutarse"]);
        },
      },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
      planGate: { propose: async () => ({ action: "discard" as const }) },
    });
    await service.run({ message: "agrega un módulo de reportes", sessionId: "sess-1", workspacePath: "/tmp/repo" }, (event) =>
      events.push(event),
    );
    expect(gatewayUsed).toBe(false);
    const finalDelta = events.filter((event) => event.kind === "assistant-delta").at(-1);
    expect(finalDelta).toMatchObject({ text: expect.stringContaining("descartado") });
  });

  it("blocks before calling the model when a pre-gate rejects the request", async () => {
    const events: ChatStreamEvent[] = [];
    let gatewayUsed = false;
    const service = new ChatService({
      gateway: {
        stream: () => {
          gatewayUsed = true;
          return streamChunks(["no debería ejecutarse"]);
        },
      },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
      budgetWindow: () => ({ tokensUsed: 500, tokensLimit: 100, costUsedUsd: 0, costLimitUsd: 5 }),
      preGateRunner: () => ({ verdict: "block", blockedBy: "budget-gate", userResponse: "presupuesto diario agotado" }),
    });
    await service.run({ message: "hola", sessionId: "s", workspacePath: "/w" }, (event) => events.push(event));
    expect(gatewayUsed).toBe(false);
    expect(events.some((event) => event.kind === "assistant-delta" && (event as { text: string }).text.includes("presupuesto"))).toBe(true);
    expect(events.some((event) => event.kind === "harness-step" && (event as { status?: string }).status === "blocked")).toBe(true);
  });

  it("reports token usage for the domain after a successful call", async () => {
    const usages: Array<{ domain: string; inputTokens: number; outputTokens: number }> = [];
    const service = new ChatService({
      gateway: { stream: () => streamChunks(["respuesta del agente"]) },
      toolRunner: makeRunner({}),
      toolWorkspacePath: "/tmp/ws",
      onUsage: (usage) => usages.push(usage),
    });
    await service.run({ message: "agrega auth", sessionId: "s", workspacePath: "/w" }, () => undefined);
    expect(usages).toHaveLength(1);
    expect(usages[0].domain).toBe("backend");
    expect(usages[0].inputTokens).toBeGreaterThan(0);
    expect(usages[0].outputTokens).toBeGreaterThan(0);
  });
});
