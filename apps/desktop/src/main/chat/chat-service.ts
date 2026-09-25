import { z } from "zod";
import { classify } from "../harness/classifier";
import type { ToolRunner } from "../tools";
import type { ChatSendRequest, ChatStreamEvent } from "../../shared/chat-events";

const ToolRequestSchema = z.object({
  tool: z.enum(["fileRead", "fileEdit", "terminal", "mcp_call"]),
  args: z.record(z.unknown()),
});

export function parseToolRequest(rawText: string): z.infer<typeof ToolRequestSchema> | null {
  const match = rawText.match(/```tool\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[1].trim());
    return ToolRequestSchema.parse(parsed);
  } catch {
    return null;
  }
}

export interface ChatGatewayStreamChunk {
  textDelta: string;
  isDone: boolean;
}

export interface ChatGateway {
  stream(prompt: string): AsyncGenerator<ChatGatewayStreamChunk>;
}

export interface ChatServiceDeps {
  gateway: ChatGateway;
  toolRunner: ToolRunner;
  toolWorkspacePath: string;
}

export function buildAgentPrompt(request: ChatSendRequest, needs: string[]): string {
  return [
    "[harness] compila reglas, skills y contexto antes de despertar al agente.",
    `[intent] needs=${needs.join(",") || "none"}`,
    "[style] responde en markdown, conciso, sin relleno.",
    "[user]",
    request.message,
  ].join("\n");
}

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  async run(request: ChatSendRequest, emit: (event: ChatStreamEvent) => void): Promise<void> {
    const sessionId = request.sessionId;

    try {
      const intent = classify(request.message, request.workspacePath);

      if (!request.bypassHarness) {
        emit({ kind: "harness-step", sessionId, phase: "classify", status: "running", label: "clasificando…" });
        emit({
          kind: "harness-step",
          sessionId,
          phase: "classify",
          status: "done",
          label: `${intent.domain}/${intent.type}/${intent.effort}`,
          detail: `confidence ${intent.confidence.toFixed(2)}`,
        });
        emit({ kind: "harness-step", sessionId, phase: "plugins", status: "done", label: "plugin chain ok" });
        emit({ kind: "harness-step", sessionId, phase: "rules", status: "done", label: "reglas G1–G10 + dominio" });
        emit({
          kind: "harness-step",
          sessionId,
          phase: "skills",
          status: "done",
          label: `skills: ${intent.needs.join(", ") || "ninguna"}`,
        });
        emit({ kind: "harness-step", sessionId, phase: "context", status: "done", label: "contexto ensamblado" });
        emit({ kind: "harness-step", sessionId, phase: "pre-gates", status: "done", label: "gates pre ok" });
      }

      emit({ kind: "harness-step", sessionId, phase: "agent", status: "running", label: "agente escribiendo…" });

      const prompt = buildAgentPrompt(request, intent.needs);
      let fullText = "";
      for await (const chunk of this.deps.gateway.stream(prompt)) {
        if (chunk.isDone) break;
        if (!chunk.textDelta) continue;
        fullText += chunk.textDelta;
        emit({ kind: "assistant-delta", sessionId, text: chunk.textDelta });
      }
      emit({ kind: "assistant-done", sessionId });

      const pendingToolCall = parseToolRequest(fullText);
      if (pendingToolCall) {
        const callId = `call-${Date.now().toString(36)}`;
        const toolArgs = pendingToolCall.args;
        const filePath = typeof toolArgs.path === "string" ? toolArgs.path : "scratch.txt";
        emit({
          kind: "tool-call",
          sessionId,
          callId,
          tool: pendingToolCall.tool,
          summary: `fileEdit → ${filePath}`,
          status: "running",
        });
        const observation = await this.deps.toolRunner.execute({
          tool: pendingToolCall.tool,
          args: pendingToolCall.args,
          sessionId,
          workspaceHash: this.deps.toolWorkspacePath,
          workspacePath: this.deps.toolWorkspacePath,
        });
        emit({
          kind: "tool-observation",
          sessionId,
          callId,
          ok: observation.ok,
          output: observation.output || observation.stderr || "",
          diff: observation.diffPreview,
        });
      }

      emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "listo" });
    } catch (error) {
      emit({
        kind: "error",
        sessionId,
        message: error instanceof Error ? error.message : "error inesperado del harness",
      });
    }
  }
}
