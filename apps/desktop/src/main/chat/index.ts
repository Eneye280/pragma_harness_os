import { AgentGateway } from "../llm/gateway";
import { ToolRunner } from "../tools";
import { resolveHarnessWorkspace } from "../workspace-path";
import { SettingsGateway, resolveGatewayConfig, type ResolvedGatewayConfig } from "../settings";
import type { SettingsController } from "../settings";
import type { PlanGate } from "../plan";
import { compileHarnessContext } from "../context";
import { PreAgentGates } from "../gates";
import { createPluginRunner } from "../plugins";
import type { CostTracker } from "../cost";
import { ChatService, type ChatGateway } from "./chat-service";

const TOOL_INTENT_PATTERN = /(archivo|file|crea|create|write|escribe|guarda|save)/i;
const CONSOLE_INTENT_PATTERN = /(console\.log|console|debug|consola)/i;

async function* mockResponder(prompt: string): AsyncGenerator<string> {
  const wantsFile = TOOL_INTENT_PATTERN.test(prompt);
  const answerParts = [
    "## Harness-first listo\n\n",
    "El harness compiló **reglas**, **skills** y **contexto** antes de despertar al agente.\n\n",
    "- clasificación determinista\n",
    "- skills compiladas en un bloque\n",
    "- presupuesto de tokens respetado\n",
  ];
  for (const part of answerParts) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    yield part;
  }
  if (wantsFile) {
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
  customPlugins?: () => import("../harness/plugin-chain").HarnessPlugin[]
): ChatService {
  const gateway = new SettingsGateway(() => settingsController.store.get(), createGatewayForConfig);
  const toolWorkspacePath = getWorkspace ?? resolveHarnessWorkspace;
  const toolRunner = new ToolRunner({ permission: "allow" });

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
  });
}

export { resolveGatewayConfig };
