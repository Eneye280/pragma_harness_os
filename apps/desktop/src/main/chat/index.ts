import { AgentGateway } from "../llm/gateway";
import { ToolRunner } from "../tools";
import { resolveHarnessWorkspace } from "../workspace-path";
import { resolveGatewayConfig, type ResolvedGatewayConfig } from "../settings";
import { ModelFallbackGateway } from "../llm/fallback";
import { fallbackChain } from "../../shared/routing";
import type { SettingsController } from "../settings";
import type { PlanGate } from "../plan";
import { compileHarnessContext } from "../context";
import { PreAgentGates } from "../gates";
import { createPluginRunner } from "../plugins";
import { SandboxRunner } from "../sandbox";
import { runTerminal } from "../tools";
import type { CostTracker } from "../cost";
import { ChatService, type ChatGateway } from "./chat-service";
import { matchScenario } from "./mock-scenarios";
import { buildWorkspaceBlock } from "./workspace-files";
import { estimateCostUsd } from "../cost/pricing";
import type { UsageEntry } from "../../shared/usage";

const TOOL_INTENT_PATTERN = /(archivo|file|crea|create|write|escribe|guarda|save)/i;
const CONSOLE_INTENT_PATTERN = /(console\.log|console|debug|consola)/i;
const TEST_INTENT_PATTERN = /(tests?|pruebas|corre los test|verifica|run tests)/i;
const TERMINAL_INTENT_PATTERN = /(inspecciona|git status|estado del repo|revisa el repo)/i;

async function* mockResponder(prompt: string): AsyncGenerator<string> {
  const answerParts = [
    "Estás usando el **provider mock**: esto es una respuesta de ejemplo.\n\n",
    "El pipeline real (clasificar → reglas → skills → contexto → gates → agente) se muestra en la **línea de tiempo** del chat.\n\n",
  ];
  for (const part of answerParts) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    yield part;
  }
  const wantsTests = TEST_INTENT_PATTERN.test(prompt);
  const wantsTerminal = !wantsTests && TERMINAL_INTENT_PATTERN.test(prompt);
  const wantsFile = !wantsTests && !wantsTerminal && TOOL_INTENT_PATTERN.test(prompt);
  const scenario = matchScenario(prompt);
  if (scenario) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const scenarioBlock = {
      tool: scenario.tool,
      args: scenario.args,
      sessionId: "mock",
      workspaceHash: "mock",
      workspacePath: ".",
    };
    yield `\n${scenario.intro}\n\n\`\`\`tool\n${JSON.stringify(scenarioBlock, null, 2)}\n\`\`\`\n`;
  } else if (wantsTests) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const verifyBlock = { tool: "runTests", args: {}, sessionId: "mock", workspaceHash: "mock", workspacePath: "." };
    yield `\nCorro los tests:\n\n\`\`\`tool\n${JSON.stringify(verifyBlock, null, 2)}\n\`\`\`\n`;
  } else if (wantsTerminal) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const terminalBlock = { tool: "terminal", args: { command: "git", args: ["status"] }, sessionId: "mock", workspaceHash: "mock", workspacePath: "." };
    yield `\nInspecciono el repo:\n\n\`\`\`tool\n${JSON.stringify(terminalBlock, null, 2)}\n\`\`\`\n`;
  } else if (wantsFile) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const wantsConsoleLog = CONSOLE_INTENT_PATTERN.test(prompt);
    const fileContent = wantsConsoleLog
      ? "# Nota del agente\n\nconsole.log('debug desde el agente');\n"
      : "# Nota del agente\n\nEscrito dentro del worktree de chat.\n";
    const toolBlock = {
      tool: "fileEdit",
      args: { path: "harness-note.md", content: fileContent },
      sessionId: "mock",
      workspaceHash: "mock",
      workspacePath: ".",
    };
    yield `\nEscribo el archivo:\n\n\`\`\`tool\n${JSON.stringify(toolBlock, null, 2)}\n\`\`\`\n`;
  }
}

export function createGatewayForConfig(config: ResolvedGatewayConfig): ChatGateway {
  if (config.provider === "mock") return new AgentGateway({ provider: "mock" }, mockResponder);
  return new AgentGateway({
    provider: config.provider,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
  });
}

export function createChatService(
  settingsController: SettingsController,
  costTracker: CostTracker,
  planGate?: PlanGate,
  onCostRecorded?: (snapshot: import("../../shared/cost").CostSnapshot) => void,
  getWorkspace?: () => string,
  pollSteer?: (sessionId: string) => string | null,
  customPlugins?: () => import("../harness/plugin-chain").HarnessPlugin[],
  toolApproval?: {
    resolvePermission: (tool: import("../tools").ToolName) => import("../tools").PermissionMode;
    requestApproval: (request: import("../tools").ToolApprovalRequest) => Promise<import("../tools").ToolApprovalDecision>;
  },
  onUsageEntry?: (entry: UsageEntry) => void,
  onPostmortem?: (entry: { sessionId: string; goal: string; outcome: "done" | "failed" | "blocked"; failures: string[]; fixes: string[]; lessons: string[] }) => void
): ChatService {
  let lastFallback: import("../llm/fallback").FallbackAttempt | null = null;
  const gateway: ChatGateway = {
    async *stream(prompt: string) {
      const settings = settingsController.store.get();
      const base = resolveGatewayConfig(settings);
      const models = fallbackChain(base.model, settings.routing.fallbackModels, settings.routing.maxRetries);
      const chained = new ModelFallbackGateway({
        models,
        create: (model) => createGatewayForConfig({ ...base, model: model || base.model }),
        onFallback: (attempt) => {
          lastFallback = attempt;
        },
      });
      for await (const chunk of chained.stream(prompt)) yield chunk;
    },
  };
  const toolWorkspacePath = getWorkspace ?? resolveHarnessWorkspace;
  const toolRunner = new ToolRunner({ permission: "allow" });
  toolRunner.configure({
    sandboxExecutor: async (request) => {
      const sandbox = settingsController.store.get().sandbox;
      if (!sandbox.enabled) {
        const plain = await runTerminal(request);
        return { stdout: plain.stdout, stderr: plain.stderr, exitCode: plain.exitCode, durationMs: plain.durationMs, timedOut: plain.timedOut };
      }
      const sandboxed = await new SandboxRunner({ settings: sandbox }).execute(request);
      return { stdout: sandboxed.stdout, stderr: sandboxed.stderr, exitCode: sandboxed.exitCode, durationMs: sandboxed.durationMs, timedOut: sandboxed.timedOut };
    },
  });

  const currentBudget = () => {
    const settings = settingsController.store.get();
    return { tokensPerDay: settings.budget.tokensPerDay, usdPerDay: settings.budget.usdPerDay };
  };

  return new ChatService({
    gateway,
    toolRunner,
    toolWorkspacePath,
    planGate,
    contextCompiler: compileHarnessContext,
    tokenLimit: settingsController.store.get().budget.tokensPerDay,
    model: () => resolveGatewayConfig(settingsController.store.get()).model,
    onUsage: (usage) => {
      const config = resolveGatewayConfig(settingsController.store.get());
      const snapshot = costTracker.recordUsage({
        domain: usage.domain,
        provider: config.provider,
        model: config.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      onCostRecorded?.(snapshot);
      onUsageEntry?.({
        ts: Date.now(),
        sessionId: usage.sessionId,
        workspace: (getWorkspace ?? resolveHarnessWorkspace)(),
        mode: usage.mode,
        domain: usage.domain,
        tokens: usage.inputTokens + usage.outputTokens,
        usd: estimateCostUsd(config.provider, config.model, usage.inputTokens, usage.outputTokens),
        calls: 1,
        durationMs: usage.durationMs,
      });
    },
    budgetWindow: () => {
      const settings = settingsController.store.get();
      const snapshot = costTracker.snapshot(currentBudget());
      return {
        tokensUsed: snapshot.today.tokens,
        tokensLimit: settings.budget.tokensPerDay,
        costUsedUsd: snapshot.today.usd,
        costLimitUsd: settings.budget.usdPerDay,
      };
    },
    preGateRunner: (context) => {
      const settings = settingsController.store.get();
      const gates = new PreAgentGates(settings.gates.pre);
      const result = gates.run(context as Parameters<PreAgentGates["run"]>[0]);
      return { verdict: result.verdict, blockedBy: result.blockedBy, userResponse: result.userResponse, reason: result.reason };
    },
    pluginRunner: createPluginRunner((name) => settingsController.store.get().plugins[name] === true, customPlugins),
    pollSteer,
    workspaceBlock: (message) => buildWorkspaceBlock(toolWorkspacePath(), message),
    resolveToolPermission: toolApproval?.resolvePermission,
    requestToolApproval: toolApproval?.requestApproval,
    onPostmortem,
    consumeFallback: () => {
      const attempt = lastFallback;
      lastFallback = null;
      return attempt;
    },
  });
}

export { resolveGatewayConfig };
