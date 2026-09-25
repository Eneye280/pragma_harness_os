import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { z } from "zod";
import { redactSecrets } from "./types";

export const McpServerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});

export const McpConfigSchema = z.object({
  mcpServers: z.record(McpServerSchema).default({}),
});

export type McpConfig = z.infer<typeof McpConfigSchema>;

export interface McpServerStatus {
  name: string;
  command: string;
  args: string[];
  reachable: boolean;
  reason: string;
}

export interface McpToolRoute {
  serverName: string;
  toolName: string;
}

const MCP_FILE_NAME = ".mcp.json";

export function loadMcpConfig(workspacePath: string): { config: McpConfig; configPath: string | null } {
  const configPath = join(resolve(workspacePath), MCP_FILE_NAME);
  if (!existsSync(configPath)) return { config: { mcpServers: {} }, configPath: null };
  const rawContent = readFileSync(configPath, "utf8");
  const parsedJson: unknown = JSON.parse(rawContent);
  const config = McpConfigSchema.parse(parsedJson);
  return { config, configPath };
}

export function redactMcpEnv(config: McpConfig): McpConfig {
  const redactedServers: McpConfig["mcpServers"] = {};
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const redactedEnv: Record<string, string> = {};
    for (const [envKey, envValue] of Object.entries(serverConfig.env)) {
      redactedEnv[envKey] = redactSecrets(envValue);
    }
    redactedServers[serverName] = { ...serverConfig, env: redactedEnv };
  }
  return { mcpServers: redactedServers };
}

export function routeMcpTool(qualifiedTool: string, config: McpConfig): McpToolRoute {
  const separatorIndex = qualifiedTool.indexOf("__");
  if (separatorIndex <= 0) throw new Error(`mcp: qualified tool must look like server__tool, got: ${qualifiedTool}`);
  const serverName = qualifiedTool.slice(0, separatorIndex);
  const toolName = qualifiedTool.slice(separatorIndex + 2);
  if (!config.mcpServers[serverName]) throw new Error(`mcp: unknown server: ${serverName}`);
  if (!toolName) throw new Error("mcp: empty tool name after server prefix");
  return { serverName, toolName };
}

export async function healthCheckMcp(
  config: McpConfig,
  probe?: (serverName: string) => Promise<boolean>
): Promise<McpServerStatus[]> {
  const statuses: McpServerStatus[] = [];
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    let reachable = true;
    let reason = "configured";
    if (probe) {
      try {
        reachable = await probe(serverName);
        reason = reachable ? "probe ok" : "probe reported unreachable";
      } catch (probeError) {
        reachable = false;
        reason = probeError instanceof Error ? probeError.message : "probe failed";
      }
    } else if (!serverConfig.command) {
      reachable = false;
      reason = "missing command";
    }
    statuses.push({ name: serverName, command: serverConfig.command, args: serverConfig.args, reachable, reason });
  }
  return statuses;
}
