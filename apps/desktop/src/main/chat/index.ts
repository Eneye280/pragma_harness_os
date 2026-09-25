import { AgentGateway } from "../llm/gateway";
import { ToolRunner } from "../tools";
import { resolveHarnessWorkspace } from "../workspace-path";
import { SettingsGateway, resolveGatewayConfig, type ResolvedGatewayConfig } from "../settings";
import type { SettingsController } from "../settings";
import type { PlanGate } from "../plan";
import { compileHarnessContext } from "../context";
import { ChatService, type ChatGateway } from "./chat-service";

const TOOL_INTENT_PATTERN = /(archivo|file|crea|create|write|escribe|guarda|save)/i;

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
    const toolBlock = {
      tool: "fileEdit",
      args: { path: "harness-note.md", content: "# Nota del agente\n\nEscrito dentro del worktree de chat.\n" },
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

export function createChatService(settingsController: SettingsController, planGate?: PlanGate): ChatService {
  const gateway = new SettingsGateway(() => settingsController.store.get(), createGatewayForConfig);
  const toolWorkspacePath = resolveHarnessWorkspace();
  const toolRunner = new ToolRunner({ permission: "allow" });
  return new ChatService({
    gateway,
    toolRunner,
    toolWorkspacePath,
    planGate,
    contextCompiler: compileHarnessContext,
    tokenLimit: settingsController.store.get().budget.tokensPerDay,
    model: () => resolveGatewayConfig(settingsController.store.get()).model,
  });
}

export { resolveGatewayConfig };
