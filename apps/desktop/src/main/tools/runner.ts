import { randomUUID } from "crypto";
import { z } from "zod";
import { FileEditHistory, readWorkspaceFile } from "./file-tools";
import { loadMcpConfig, redactMcpEnv, routeMcpTool } from "./mcp";
import { runTerminal } from "./terminal";
import { runVerifyTool } from "./verify-tools";
import { checkTerminalCommand } from "./allowlist";
import { webFetch } from "./web";
import { redactSecrets, type ApproveHook, type ConfirmHook, type PermissionMode, type ToolApprovalRequest, type ToolCallInput, type ToolCallRecord, type ToolName, type ToolObservation } from "./types";

export const FileReadArgsSchema = z.object({ path: z.string().min(1) });
export const FileEditArgsSchema = z.object({ path: z.string().min(1), content: z.string() });
export const TerminalArgsSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().max(120000).optional(),
});
export const McpCallArgsSchema = z.object({
  qualifiedTool: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});
export const WebFetchArgsSchema = z.object({ url: z.string().url() });
export const VerifyArgsSchema = z.object({
  timeoutMs: z.number().int().positive().max(180000).optional(),
  domain: z.string().optional(),
});

export interface RunnerOptions {
  permission: PermissionMode;
  permissionFor?: (tool: ToolName) => PermissionMode;
  approveTool?: ApproveHook;
  confirm?: ConfirmHook;
  mcpExecutor?: (route: { serverName: string; toolName: string }, params: Record<string, unknown>) => Promise<string>;
  sandboxExecutor?: (request: { command: string; args: string[]; workspacePath: string; timeoutMs?: number }) => Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean }>;
  eventSink?: (eventType: "agent:tool-call" | "agent:observation", payload: unknown, sessionId: string, workspaceHash: string) => void;
}

export interface AgentLoopOptions extends RunnerOptions {
  maxIterations?: number;
  parseToolCall?: (llmText: string) => ToolCallInput | null;
}

export interface AgentLoopResult {
  finalText: string;
  iterations: number;
  toolCalls: number;
  observations: ToolObservation[];
}

export interface GatewayLike {
  collect(prompt: string): Promise<string>;
}

const DEFAULT_MAX_ITERATIONS = 6;

export function parseToolCallFromText(llmText: string): ToolCallInput | null {
  const match = llmText.match(/```tool\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[1].trim());
    const schema = z.object({
      tool: z.enum(["fileRead", "fileEdit", "terminal", "mcp_call", "runTests", "runBuild", "runLint", "webFetch"]),
      args: z.record(z.unknown()),
      sessionId: z.string(),
      workspaceHash: z.string(),
      workspacePath: z.string(),
    });
    const validated = schema.parse(parsed);
    return { tool: validated.tool as ToolName, args: validated.args as Record<string, unknown>, sessionId: validated.sessionId, workspaceHash: validated.workspaceHash, workspacePath: validated.workspacePath };
  } catch {
    return null;
  }
}

export class ToolRunner {
  private readonly fileHistory = new FileEditHistory();

  constructor(private options: RunnerOptions = { permission: "allow" }) {}

  configure(partial: Partial<RunnerOptions>): void {
    this.options = { ...this.options, ...partial };
  }

  undoLastFileEdit() {
    return this.fileHistory.undoLast();
  }

  pendingUndoCount(): number {
    return this.fileHistory.pendingCount();
  }

  async execute(input: ToolCallInput): Promise<ToolObservation> {
    const callRecord: ToolCallRecord = {
      id: randomUUID(),
      tool: input.tool,
      args: input.args,
      sessionId: input.sessionId,
      ts: Date.now(),
    };
    this.emitEvent("agent:tool-call", { ...callRecord, args: this.redactArgs(callRecord.args) }, input.sessionId, input.workspaceHash);
    const startedAt = Date.now();

    try {
      const denied = await this.authorize(input, callRecord.id, startedAt);
      const observation = denied ?? (await this.dispatch(input, callRecord.id, startedAt));
      this.emitEvent("agent:observation", observation, input.sessionId, input.workspaceHash);
      return observation;
    } catch (dispatchError) {
      const observation: ToolObservation = {
        callId: callRecord.id,
        tool: input.tool,
        ok: false,
        output: dispatchError instanceof Error ? dispatchError.message : "unknown tool error",
        durationMs: Date.now() - startedAt,
        ts: Date.now(),
      };
      this.emitEvent("agent:observation", observation, input.sessionId, input.workspaceHash);
      return observation;
    }
  }

  private emitEvent(eventType: "agent:tool-call" | "agent:observation", payload: unknown, sessionId: string, workspaceHash: string): void {
    this.options.eventSink?.(eventType, payload, sessionId, workspaceHash);
  }

  private redactArgs(rawArgs: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [argKey, argValue] of Object.entries(rawArgs)) {
      redacted[argKey] = typeof argValue === "string" ? redactSecrets(argValue) : argValue;
    }
    return redacted;
  }

  private summarize(input: ToolCallInput): string {
    const args = input.args as { path?: unknown; command?: unknown; qualifiedTool?: unknown };
    if (typeof args.path === "string") return `${input.tool} → ${args.path}`;
    if (typeof args.command === "string") return `${input.tool} → ${args.command}`;
    if (typeof args.qualifiedTool === "string") return `${input.tool} → ${args.qualifiedTool}`;
    return input.tool;
  }

  private async authorize(input: ToolCallInput, callId: string, startedAt: number): Promise<ToolObservation | null> {
    const mode = this.options.permissionFor?.(input.tool) ?? this.options.permission;
    if (mode === "allow") return null;
    if (mode === "deny") {
      return {
        callId,
        tool: input.tool,
        ok: false,
        output: "",
        blocked: true,
        blockReason: `${input.tool} denied by permission policy`,
        durationMs: Date.now() - startedAt,
        ts: Date.now(),
      };
    }
    const request: ToolApprovalRequest = { callId, tool: input.tool, summary: this.summarize(input), sessionId: input.sessionId, args: input.args };
    const decision = this.options.approveTool ? await this.options.approveTool(request) : { approved: false };
    if (!decision.approved) {
      return {
        callId,
        tool: input.tool,
        ok: false,
        output: "",
        blocked: true,
        blockReason: `${input.tool} rejected by user`,
        durationMs: Date.now() - startedAt,
        ts: Date.now(),
      };
    }
    return null;
  }

  private async dispatch(input: ToolCallInput, callId: string, startedAt: number): Promise<ToolObservation> {
    switch (input.tool) {
      case "fileRead": {
        const parsedArgs = FileReadArgsSchema.parse(input.args);
        const fileResult = readWorkspaceFile(input.workspacePath, parsedArgs.path);
        return {
          callId,
          tool: input.tool,
          ok: true,
          output: redactSecrets(fileResult.content).slice(0, 20000),
          durationMs: Date.now() - startedAt,
          ts: Date.now(),
        };
      }
      case "fileEdit": {
        const parsedArgs = FileEditArgsSchema.parse(input.args);
        const preview = this.fileHistory.buildPreview({
          relativePath: parsedArgs.path,
          content: parsedArgs.content,
          workspacePath: input.workspacePath,
          sessionId: input.sessionId,
        });
        if (this.options.permission === "deny") {
          return {
            callId,
            tool: input.tool,
            ok: false,
            output: "",
            blocked: true,
            blockReason: "fileEdit denied by permission mode",
            durationMs: Date.now() - startedAt,
            ts: Date.now(),
          };
        }
        if (this.options.permission === "ask") {
          const approved = this.options.confirm ? await this.options.confirm({ ...preview, callId }) : false;
          if (!approved) {
            return {
              callId,
              tool: input.tool,
              ok: false,
              output: "",
              blocked: true,
              blockReason: "fileEdit rejected by user confirmation",
              diffPreview: preview.diffPreview,
              durationMs: Date.now() - startedAt,
              ts: Date.now(),
            };
          }
        }
        const applied = this.fileHistory.applyPreview({ ...preview, callId });
        return {
          callId,
          tool: input.tool,
          ok: true,
          output: `wrote ${applied.relativePath} (${applied.created ? "created" : "updated"})`,
          diffPreview: applied.diffPreview,
          durationMs: Date.now() - startedAt,
          ts: Date.now(),
        };
      }
      case "terminal": {
        const parsedArgs = TerminalArgsSchema.parse(input.args);
        const allowlist = checkTerminalCommand(parsedArgs.command, parsedArgs.args);
        if (!allowlist.allowed) {
          return {
            callId,
            tool: input.tool,
            ok: false,
            output: "",
            blocked: true,
            blockReason: `allowlist: ${allowlist.reason}`,
            durationMs: Date.now() - startedAt,
            ts: Date.now(),
          };
        }
        const terminalResult = this.options.sandboxExecutor
          ? await this.options.sandboxExecutor({
              command: parsedArgs.command,
              args: parsedArgs.args,
              workspacePath: input.workspacePath,
              timeoutMs: parsedArgs.timeoutMs,
            })
          : await runTerminal({
              command: parsedArgs.command,
              args: parsedArgs.args,
              workspacePath: input.workspacePath,
              timeoutMs: parsedArgs.timeoutMs,
            });
        return {
          callId,
          tool: input.tool,
          ok: terminalResult.exitCode === 0 && !terminalResult.timedOut,
          output: redactSecrets(terminalResult.stdout),
          stderr: redactSecrets(terminalResult.stderr),
          exitCode: terminalResult.exitCode,
          durationMs: terminalResult.durationMs,
          ts: Date.now(),
        };
      }
      case "runBuild":
      case "runTests":
      case "runLint": {        const parsedArgs = VerifyArgsSchema.parse(input.args ?? {});
        const result = await runVerifyTool(input.tool, input.workspacePath, { timeoutMs: parsedArgs.timeoutMs, domain: parsedArgs.domain });
        return {
          callId,
          tool: input.tool,
          ok: result.ok,
          output: `${result.command}\n${result.output}`,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          ts: Date.now(),
        };
      }
      case "webFetch": {
        const parsedArgs = WebFetchArgsSchema.parse(input.args);
        const result = await webFetch(parsedArgs.url);
        return {
          callId,
          tool: input.tool,
          ok: result.ok,
          output: result.ok ? `${result.title}\n${result.excerpt}` : result.error ?? "web fetch failed",
          durationMs: Date.now() - startedAt,
          ts: Date.now(),
        };
      }
      case "mcp_call": {
        const parsedArgs = McpCallArgsSchema.parse(input.args);
        const { config } = loadMcpConfig(input.workspacePath);
        const redactedConfig = redactMcpEnv(config);
        const route = routeMcpTool(parsedArgs.qualifiedTool, redactedConfig);
        if (!this.options.mcpExecutor) {
          return {
            callId,
            tool: input.tool,
            ok: false,
            output: `mcp server configured: ${route.serverName}, tool: ${route.toolName} (no live executor — stub observation)`,
            durationMs: Date.now() - startedAt,
            ts: Date.now(),
          };
        }
        const executorOutput = await this.options.mcpExecutor(route, parsedArgs.params as Record<string, unknown>);
        return {
          callId,
          tool: input.tool,
          ok: true,
          output: redactSecrets(executorOutput).slice(0, 20000),
          durationMs: Date.now() - startedAt,
          ts: Date.now(),
        };
      }
    }
  }

  async runAgentLoop(gateway: GatewayLike, initialPrompt: string, loopOptions: Omit<AgentLoopOptions, keyof RunnerOptions> = {}): Promise<AgentLoopResult> {
    const maxIterations = loopOptions.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const parser = loopOptions.parseToolCall ?? parseToolCallFromText;
    const observations: ToolObservation[] = [];
    let currentPrompt = initialPrompt;
    let toolCalls = 0;
    let iteration = 0;
    let finalText = "";

    while (iteration < maxIterations) {
      iteration += 1;
      const llmText = await gateway.collect(currentPrompt);
      const pendingCall = parser(llmText);
      if (!pendingCall) {
        finalText = llmText;
        break;
      }
      toolCalls += 1;
      const observation = await this.execute(pendingCall);
      observations.push(observation);
      currentPrompt = `${currentPrompt}\n\n[observation:${observation.tool}:${observation.ok ? "ok" : "error"}]\n${observation.output}${observation.stderr ? `\nstderr:\n${observation.stderr}` : ""}`;
      finalText = llmText;
    }

    return { finalText, iterations: iteration, toolCalls, observations };
  }
}
