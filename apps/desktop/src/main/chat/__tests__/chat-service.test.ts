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
});
