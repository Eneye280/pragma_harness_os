import { describe, it, expect } from "vitest";
import { ChatService } from "../chat-service";
import type { ChatStreamEvent } from "../../../shared/chat-events";
import type { ToolRunner } from "../../tools";

async function* streamChunks(chunks: string[]) {
  for (const chunk of chunks) yield { textDelta: chunk, isDone: false };
  yield { textDelta: "", isDone: true };
}

const runner = { execute: async () => ({ callId: "c", tool: "fileEdit", ok: true, output: "", diffPreview: "", durationMs: 1, ts: 0 }) } as unknown as ToolRunner;

describe("ChatService steering and cancel", () => {
  it("re-evaluates and continues when a steer message is queued", async () => {
    const events: ChatStreamEvent[] = [];
    const queued = ["usa licencias"];
    const service = new ChatService({
      gateway: { stream: () => streamChunks(["parte"]) },
      toolRunner: runner,
      toolWorkspacePath: "/tmp/ws",
      pollSteer: () => queued.shift() ?? null,
    });

    await service.run({ message: "haz auth", sessionId: "s1", workspacePath: "/w" }, (event) => events.push(event));

    const userMessage = events.find((event) => event.kind === "user-message");
    expect(userMessage).toMatchObject({ kind: "user-message", text: "usa licencias", steer: true });
    expect(events.filter((event) => event.kind === "assistant-done").length).toBeGreaterThanOrEqual(2);
    const steeringClassify = events.find(
      (event) => event.kind === "harness-step" && (event as { detail?: string }).detail === "steering"
    );
    expect(steeringClassify).toBeTruthy();
  });

  it("stops streaming and marks the run cancelled when aborted", async () => {
    const controller = new AbortController();
    const events: ChatStreamEvent[] = [];
    const service = new ChatService({
      gateway: {
        stream: async function* () {
          yield { textDelta: "a", isDone: false };
          controller.abort();
          yield { textDelta: "b", isDone: false };
          yield { textDelta: "", isDone: true };
        },
      },
      toolRunner: runner,
      toolWorkspacePath: "/tmp/ws",
    });

    await service.run({ message: "x", sessionId: "s1", workspacePath: "/w" }, (event) => events.push(event), {
      signal: controller.signal,
    });

    const deltas = events.filter((event) => event.kind === "assistant-delta").map((event) => (event as { text: string }).text);
    expect(deltas).toEqual(["a"]);
    expect(events.some((event) => event.kind === "harness-step" && (event as { label?: string }).label === "cancelado por el usuario")).toBe(true);
  });
});
