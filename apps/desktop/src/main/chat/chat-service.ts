import { z } from "zod";
import { classify } from "../harness/classifier";
import { approximateTokens } from "../cost";
import { buildPlan, shouldProposePlan } from "../plan";
import type { PlanGate } from "../plan";
import type { ToolRunner } from "../tools";
import type { ChatSendRequest, ChatStreamEvent } from "../../shared/chat-events";
import { buildAttachmentNote } from "../../shared/attachments";
import { DEFAULT_STUCK_TIMEOUT_MS, diagnoseStuck, StuckMonitor } from "../../shared/stuck";

const ToolRequestSchema = z.object({
  tool: z.enum(["fileRead", "fileEdit", "terminal", "mcp_call", "runTests", "runBuild", "runLint", "webFetch"]),
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

/** Todos los bloques ```tool válidos del texto, en orden. */
export function parseToolRequests(rawText: string): Array<z.infer<typeof ToolRequestSchema>> {
  const requests: Array<z.infer<typeof ToolRequestSchema>> = [];
  for (const match of rawText.matchAll(/```tool\s*([\s\S]*?)```/g)) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      const result = ToolRequestSchema.safeParse(parsed);
      if (result.success) requests.push(result.data);
    } catch {
      // bloque inválido: se ignora
    }
  }
  return requests;
}

export const MAX_TOOL_ROUNDS = 6;

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
  toolWorkspacePath: string | (() => string);
  planGate?: PlanGate;
  contextCompiler?: (input: {
    message: string;
    intent: { domain: string; type: string; effort: string; needs: string[]; confidence: number };
    sessionId: string;
    workspacePath: string;
    tokenLimit: number;
    model: string;
  }) => Promise<{ snapshot: import("../../shared/context-snapshot").HarnessContextSnapshot; finalPrompt: string }>;
  tokenLimit?: number;
  model?: () => string;
  onUsage?: (usage: { domain: string; inputTokens: number; outputTokens: number; sessionId: string; mode: "harness" | "bypass"; durationMs: number }) => void;
  budgetWindow?: () => { tokensUsed: number; tokensLimit: number; costUsedUsd: number; costLimitUsd: number };
  preGateRunner?: (context: {
    message: string;
    normalized: string;
    sessionId: string;
    workspaceHash: string;
    workspacePath: string;
    workspaceExists: boolean;
    intent: { domain: string; type: string; effort: string; needs: string[] };
    budget?: { tokensUsed: number; tokensLimit: number; costUsedUsd: number; costLimitUsd: number };
  }) => { verdict: "pass" | "block"; blockedBy?: string; userResponse?: string; reason?: string };
  pluginRunner?: import("../plugins").PluginRunner;
  pollSteer?: (sessionId: string) => string | null;
  resolveToolPermission?: (tool: import("../tools").ToolName) => import("../tools").PermissionMode;
  requestToolApproval?: (request: import("../tools").ToolApprovalRequest) => Promise<import("../tools").ToolApprovalDecision>;
  consumeFallback?: () => import("../llm/fallback").FallbackAttempt | null;
  stuckTimeoutMs?: number;
  onPostmortem?: (entry: { sessionId: string; goal: string; outcome: "done" | "failed" | "blocked"; failures: string[]; fixes: string[]; lessons: string[] }) => void;
}

export const TOOL_PROTOCOL = [
  "[tools] para leer o modificar el proyecto debes emitir uno o más bloques con este formato exacto:",
  "```tool",
  '{"tool":"fileEdit","args":{"path":"index.html","content":"<html>…</html>"}}',
  "```",
  "[tools] disponibles: fileRead{path}, fileEdit{path,content}, terminal{command,args[]}, runTests{}, runBuild{}, runLint{}, webFetch{url}, mcp_call{server,tool,args}. Las rutas son relativas al proyecto. Usa un bloque por archivo; no describas el bloque, emítelo.",
].join("\n");

export function buildAgentPrompt(request: ChatSendRequest, needs: string[], approvedPlan?: string): string {
  const sections = [
    "[harness] compila reglas, skills y contexto antes de despertar al agente.",
    `[intent] needs=${needs.join(",") || "none"}`,
    "[style] responde en markdown, conciso, sin relleno.",
    "[scope] haz exactamente lo pedido, ni más ni menos. Si detectas algo extra útil, sugiérelo al final en una sección «Sugerencias», pero NO lo ejecutes ni modifiques nada fuera del alcance.",
    TOOL_PROTOCOL,
  ];
  if (approvedPlan) sections.push("[plan aprobado por el usuario]", approvedPlan);
  sections.push("[user]", request.message);
  return sections.join("\n");
}

/** Prompt de continuación tras ejecutar tools: devuelve las observaciones al modelo. */
export function buildToolFollowupPrompt(basePrompt: string, modelText: string, observations: Array<{ tool: string; ok: boolean; output: string }>): string {
  const results = observations
    .map((observation) => `- ${observation.tool}: ${observation.ok ? "ok" : "error"} — ${observation.output.slice(0, 500) || "(sin salida)"}`)
    .join("\n");
  return [
    basePrompt,
    "[assistant anterior]",
    modelText.slice(-2000),
    "[resultado de las tools]",
    results,
    "[instrucción] continúa en el mismo formato. Si ya terminaste la tarea, responde un resumen breve sin bloques ```tool.",
  ].join("\n");
}

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  async run(request: ChatSendRequest, emit: (event: ChatStreamEvent) => void, options: { signal?: AbortSignal } = {}): Promise<void> {
    const sessionId = request.sessionId;
    const signal = options.signal;
    const runStartedAt = Date.now();
    const stuck = new StuckMonitor(this.deps.stuckTimeoutMs ?? DEFAULT_STUCK_TIMEOUT_MS);
    let stuckReported = false;
    const stuckTimer = setInterval(() => {
      if (stuckReported || !stuck.isStuck()) return;
      stuckReported = true;
      emit({
        kind: "harness-step",
        sessionId,
        phase: "agent",
        status: "blocked",
        label: "sin progreso > 10 min — refresca contexto/reintenta o cancela",
        detail: diagnoseStuck({ lastEvent: "agent", retries: 0, externalWait: true }),
      });
    }, Math.max(5000, Math.min(30000, Math.floor((this.deps.stuckTimeoutMs ?? DEFAULT_STUCK_TIMEOUT_MS) / 4))));
    const trackProgress = (event: ChatStreamEvent): void => {
      if (event.kind !== "harness-step" || event.status !== "running") stuck.note();
    };
    const originalEmit = emit;
    emit = (event: ChatStreamEvent) => {
      trackProgress(event);
      originalEmit(event);
    };
    const attachmentNote = buildAttachmentNote(request.attachments);

    try {
      const intent = classify(request.message, request.workspacePath);

      if (attachmentNote) {
        emit({
          kind: "harness-step",
          sessionId,
          phase: "context",
          status: "done",
          label: `adjuntos: ${request.attachments?.length ?? 0}`,
          detail: attachmentNote.slice(0, 240),
        });
      }

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
        emit({ kind: "harness-step", sessionId, phase: "pre-gates", status: "running", label: "gates pre…" });
      }

      if (!request.bypassHarness && this.deps.preGateRunner) {
        const budget = this.deps.budgetWindow?.();
        const gateResult = this.deps.preGateRunner({
          message: request.message,
          normalized: request.message,
          sessionId,
          workspaceHash: request.workspacePath,
          workspacePath: request.workspacePath,
          workspaceExists: true,
          intent,
          budget,
        });
        if (gateResult.verdict === "block") {
          emit({
            kind: "harness-step",
            sessionId,
            phase: "pre-gates",
            status: "blocked",
            label: `bloqueado: ${gateResult.blockedBy ?? "gate"}`,
          });
          emit({ kind: "assistant-delta", sessionId, text: gateResult.userResponse ?? "Bloqueado por el harness antes de llamar al modelo." });
          emit({ kind: "assistant-done", sessionId });
          emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "sin llamada al modelo" });
          return;
        }
        emit({ kind: "harness-step", sessionId, phase: "pre-gates", status: "done", label: "gates pre ok" });
      }

      if (!request.bypassHarness && this.deps.pluginRunner) {
        const pluginResult = await this.deps.pluginRunner.runPreAgent({
          message: request.message,
          normalized: request.message,
          sessionId,
          workspaceHash: request.workspacePath,
          workspacePath: request.workspacePath,
          intent,
          timestamp: Date.now(),
        });
        if (pluginResult.blocked) {
          emit({ kind: "harness-step", sessionId, phase: "plugins", status: "blocked", label: `plugin: ${pluginResult.blocked.plugin}` });
          emit({ kind: "assistant-delta", sessionId, text: pluginResult.blocked.reason });
          emit({ kind: "assistant-done", sessionId });
          emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "sin llamada al modelo" });
          return;
        }
        emit({ kind: "harness-step", sessionId, phase: "plugins", status: "done", label: "plugins pre ok" });
      }

      let approvedPlanMarkdown: string | undefined;
      let assembledPrompt = "";

      if (!request.bypassHarness && this.deps.contextCompiler) {
        try {
          const compiled = await this.deps.contextCompiler({
            message: request.message,
            intent,
            sessionId,
            workspacePath: request.workspacePath,
            tokenLimit: this.deps.tokenLimit ?? 8000,
            model: this.deps.model?.() ?? "executor",
          });
          assembledPrompt = compiled.finalPrompt;
          emit({ kind: "context-assembled", sessionId, snapshot: compiled.snapshot });
        } catch {
          assembledPrompt = "";
        }
      }

      if (!request.bypassHarness && this.deps.planGate && shouldProposePlan(intent, request.message)) {
        const plan = buildPlan(request.message, intent, sessionId);
        emit({ kind: "harness-step", sessionId, phase: "plan", status: "running", label: "plan propuesto" });
        const decision = await this.deps.planGate.propose(plan, emit);
        if (decision.action === "discard") {
          emit({ kind: "harness-step", sessionId, phase: "plan", status: "blocked", label: "plan descartado" });
          emit({ kind: "assistant-delta", sessionId, text: "_Plan descartado. No se ejecutó nada._" });
          emit({ kind: "assistant-done", sessionId });
          emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "sin ejecución" });
          return;
        }
        approvedPlanMarkdown = decision.markdown;
        emit({ kind: "harness-step", sessionId, phase: "plan", status: "done", label: "plan aprobado" });
      }

      emit({ kind: "harness-step", sessionId, phase: "agent", status: "running", label: "agente escribiendo…" });

      const prompt = approvedPlanMarkdown
        ? buildAgentPrompt(request, intent.needs, approvedPlanMarkdown)
        : assembledPrompt || buildAgentPrompt(request, intent.needs);
      const finalPrompt = attachmentNote ? `${prompt}\n\n[adjuntos]\n${attachmentNote}` : prompt;
      let fullText = "";
      for await (const chunk of this.deps.gateway.stream(finalPrompt)) {
        if (signal?.aborted) break;
        if (chunk.isDone) break;
        if (!chunk.textDelta) continue;
        fullText += chunk.textDelta;
        emit({ kind: "assistant-delta", sessionId, text: chunk.textDelta });
      }
      emit({ kind: "assistant-done", sessionId });
      const fallback = this.deps.consumeFallback?.();
      if (fallback) {
        emit({ kind: "harness-step", sessionId, phase: "agent", status: "running", label: `provider fallback → ${fallback.model}` });
      }
      this.deps.onUsage?.({
        domain: intent.domain,
        inputTokens: approximateTokens(finalPrompt),
        outputTokens: approximateTokens(fullText),
        sessionId,
        mode: request.bypassHarness ? "bypass" : "harness",
        durationMs: Date.now() - runStartedAt,
      });

      let steerRound = 0;
      let combinedMessage = request.message;
      while (!signal?.aborted && steerRound < 3) {
        const steerText = this.deps.pollSteer?.(sessionId);
        if (!steerText) break;
        steerRound += 1;
        combinedMessage = `${combinedMessage}\n${steerText}`;
        emit({ kind: "user-message", sessionId, text: steerText, steer: true });
        emit({ kind: "harness-step", sessionId, phase: "classify", status: "running", label: "re-evaluando mensaje añadido…" });
        const reIntent = classify(combinedMessage, request.workspacePath);
        emit({
          kind: "harness-step",
          sessionId,
          phase: "classify",
          status: "done",
          label: `${reIntent.domain}/${reIntent.type}/${reIntent.effort}`,
          detail: "steering",
        });
        let steerPrompt = "";
        if (!request.bypassHarness && this.deps.contextCompiler) {
          try {
            const compiled = await this.deps.contextCompiler({
              message: combinedMessage,
              intent: reIntent,
              sessionId,
              workspacePath: request.workspacePath,
              tokenLimit: this.deps.tokenLimit ?? 8000,
              model: this.deps.model?.() ?? "executor",
            });
            steerPrompt = compiled.finalPrompt;
            emit({ kind: "context-assembled", sessionId, snapshot: compiled.snapshot });
          } catch {
            steerPrompt = "";
          }
        }
        emit({ kind: "harness-step", sessionId, phase: "agent", status: "running", label: "agente continúa…" });
        const continuationPrompt =
          steerPrompt || buildAgentPrompt({ ...request, message: combinedMessage }, reIntent.needs, approvedPlanMarkdown);
        for await (const chunk of this.deps.gateway.stream(continuationPrompt)) {
          if (signal?.aborted) break;
          if (chunk.isDone) break;
          if (!chunk.textDelta) continue;
          fullText += chunk.textDelta;
          emit({ kind: "assistant-delta", sessionId, text: chunk.textDelta });
        }
        emit({ kind: "assistant-done", sessionId });
      }

      if (signal?.aborted) {
        emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "cancelado por el usuario" });
        return;
      }

      let lastDiff: string | undefined;

      if (this.deps.resolveToolPermission) {
        this.deps.toolRunner.configure({
          permissionFor: this.deps.resolveToolPermission,
          approveTool: async (request) => {
            emit({ kind: "tool-approval", sessionId, callId: request.callId, tool: request.tool, summary: request.summary });
            return this.deps.requestToolApproval ? this.deps.requestToolApproval(request) : { approved: false };
          },
        });
      }

      // Bucle agéntico: ejecuta las tools que proponga el modelo y le devuelve
      // los resultados hasta que deje de pedir tools (o se alcance el tope).
      const executed = new Set<string>();
      let agentText = fullText;
      for (let round = 0; round < MAX_TOOL_ROUNDS && !signal?.aborted; round += 1) {
        const requests = parseToolRequests(agentText).filter((request) => !executed.has(JSON.stringify(request)));
        if (requests.length === 0) break;

        const observations: Array<{ tool: string; ok: boolean; output: string }> = [];
        for (const pendingToolCall of requests) {
          executed.add(JSON.stringify(pendingToolCall));
          const callId = `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          const toolArgs = pendingToolCall.args;
          const filePath = typeof toolArgs.path === "string" ? toolArgs.path : "";
          const toolSummary = filePath ? `${pendingToolCall.tool} → ${filePath}` : pendingToolCall.tool;
          emit({ kind: "tool-call", sessionId, callId, tool: pendingToolCall.tool, summary: toolSummary, status: "running" });

          const toolWorkspacePath =
            typeof this.deps.toolWorkspacePath === "function" ? this.deps.toolWorkspacePath() : this.deps.toolWorkspacePath;
          const observation = await this.deps.toolRunner.execute({
            tool: pendingToolCall.tool,
            args: pendingToolCall.args,
            sessionId,
            workspaceHash: toolWorkspacePath,
            workspacePath: toolWorkspacePath,
          });
          lastDiff = observation.diffPreview ?? lastDiff;
          const output = observation.output || observation.stderr || "";
          observations.push({ tool: pendingToolCall.tool, ok: observation.ok, output });
          emit({ kind: "tool-observation", sessionId, callId, ok: observation.ok, output, diff: observation.diffPreview });
        }

        if (signal?.aborted) break;
        emit({ kind: "harness-step", sessionId, phase: "agent", status: "running", label: "agente continúa tras las tools…" });
        const followup = buildToolFollowupPrompt(finalPrompt, agentText, observations);
        let nextText = "";
        for await (const chunk of this.deps.gateway.stream(followup)) {
          if (signal?.aborted) break;
          if (chunk.isDone) break;
          if (!chunk.textDelta) continue;
          nextText += chunk.textDelta;
          emit({ kind: "assistant-delta", sessionId, text: chunk.textDelta });
        }
        emit({ kind: "assistant-done", sessionId });
        fullText += `\n${nextText}`;
        agentText = nextText;
        if (!nextText.trim()) break;
      }

      if (!request.bypassHarness && this.deps.pluginRunner) {
        const postResult = await this.deps.pluginRunner.runPostAgent({
          message: request.message,
          normalized: request.message,
          sessionId,
          workspaceHash: request.workspacePath,
          workspacePath: request.workspacePath,
          intent,
          timestamp: Date.now(),
          diff: lastDiff,
        });
        if (postResult.blocked) {
          emit({ kind: "harness-step", sessionId, phase: "agent", status: "blocked", label: `post-gate: ${postResult.blocked.plugin}` });
          emit({
            kind: "assistant-delta",
            sessionId,
            text: `\n\n**Fix requerido** (${postResult.blocked.plugin}): ${postResult.blocked.reason}`,
          });
          emit({ kind: "assistant-done", sessionId });
          emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "bloqueado por post-gate" });
          return;
        }
      }

      this.deps.onPostmortem?.({ sessionId, goal: request.message, outcome: "done", failures: [], fixes: [], lessons: [] });
      emit({ kind: "harness-step", sessionId, phase: "agent", status: "done", label: "listo" });
    } catch (error) {
      emit({
        kind: "error",
        sessionId,
        message: error instanceof Error ? error.message : "error inesperado del harness",
      });
    } finally {
      clearInterval(stuckTimer);
    }
  }
}
