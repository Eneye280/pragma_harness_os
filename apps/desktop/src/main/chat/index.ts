import { AgentGateway } from "../llm/gateway";
import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ToolRunner } from "../tools";
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

export function createChatService(): ChatService {
  const apiKey = process.env["DEEPSEEK_API_KEY"];
  const gateway: ChatGateway = apiKey
    ? new AgentGateway({ provider: "deepseek", apiKey })
    : new AgentGateway({ provider: "mock" }, mockResponder);

  const scratchPath = join(tmpdir(), "pragma-harness", "chat-scratch");
  if (!existsSync(scratchPath)) mkdirSync(scratchPath, { recursive: true });
  const toolRunner = new ToolRunner({ permission: "allow" });

  return new ChatService({ gateway, toolRunner, toolWorkspacePath: scratchPath });
}
