import type { ProjectProfileInfo } from "./profile";
import { DEFAULT_ROUTING_RULES } from "./routing";

export type ProviderName = "mock" | "deepseek" | "anthropic" | "openai" | "ollama";

export interface RoutingSettings {
  rules: import("./routing").RoutingRule[];
  fallbackModels: string[];
  maxRetries: number;
}

export const KNOWN_PROVIDERS: ProviderName[] = ["mock", "deepseek", "anthropic", "openai", "ollama"];
export const KNOWN_PLUGINS = ["commit-guard", "secret-scan", "no-console-log"] as const;
export const SECRET_MASK = "••••••••";

export interface PreGateFlags {
  enabled: boolean;
  secret: boolean;
  budget: boolean;
  schema: boolean;
}

export interface PostGateFlags {
  enabled: boolean;
  build: boolean;
  typecheck: boolean;
  lint: boolean;
  tests: boolean;
  security: boolean;
  visual: boolean;
}

export interface BudgetSettings {
  tokensPerDay: number;
  usdPerDay: number;
}

export interface SandboxFlags {
  enabled: boolean;
  image: string;
  network: boolean;
  cpus: number;
  memoryMb: number;
  readOnlyWorkspace: boolean;
}

export interface WorkspaceSettings {
  active: string;
  recents: string[];
}

export type ToolPermissionMode = "allow" | "ask" | "deny";
export type ToolNameKey = "fileRead" | "fileEdit" | "terminal" | "mcp_call" | "runTests" | "runBuild" | "runLint";
export const KNOWN_TOOLS: ToolNameKey[] = ["fileRead", "fileEdit", "terminal", "mcp_call", "runTests", "runBuild", "runLint"];
const READ_ONLY_TOOLS: ToolNameKey[] = ["fileRead", "runTests", "runBuild", "runLint"];

export interface ToolPermissionSettings {
  askBeforeTools: boolean;
  perTool: Partial<Record<ToolNameKey, ToolPermissionMode>>;
}

export function effectiveToolPermission(tool: ToolNameKey, settings: ToolPermissionSettings): ToolPermissionMode {
  const explicit = settings.perTool[tool];
  if (explicit) return explicit;
  if (!settings.askBeforeTools) return "allow";
  return READ_ONLY_TOOLS.includes(tool) ? "allow" : "ask";
}

export const TOOL_PERMISSION_PRESETS: Record<"seguro" | "autonomo", ToolPermissionSettings> = {
  seguro: { askBeforeTools: true, perTool: { fileRead: "allow", fileEdit: "ask", terminal: "ask", mcp_call: "ask" } },
  autonomo: { askBeforeTools: false, perTool: {} },
};

export interface ProviderSettings {
  provider: ProviderName;
  apiKey: string;
  baseURL: string;
  models: {
    classifier: string;
    executor: string;
  };
}

export interface HarnessSettings {
  provider: ProviderSettings;
  budget: BudgetSettings;
  gates: { pre: PreGateFlags; post: PostGateFlags };
  plugins: Record<string, boolean>;
  skills: Record<string, boolean>;
  agent: string;
  sandbox: SandboxFlags;
  workspace: WorkspaceSettings;
  tools: ToolPermissionSettings;
  routing: RoutingSettings;
  updater: UpdaterFeedSettings;
}

export interface UpdaterFeedSettings {
  feedUrl: string;
  token: string;
  channel: "stable" | "beta";
}

export const DEFAULT_SETTINGS: HarnessSettings = {
  provider: {
    provider: "mock",
    apiKey: "",
    baseURL: "",
    models: { classifier: "deepseek-chat", executor: "deepseek-chat" },
  },
  budget: { tokensPerDay: 200000, usdPerDay: 5 },
  gates: {
    pre: { enabled: true, secret: true, budget: true, schema: true },
    post: { enabled: true, build: true, typecheck: true, lint: true, tests: true, security: true, visual: true },
  },
  plugins: { "commit-guard": false, "secret-scan": true, "no-console-log": true },
  skills: {},
  agent: "",
  sandbox: { enabled: false, image: "node:22", network: false, cpus: 1, memoryMb: 1024, readOnlyWorkspace: true },
  workspace: { active: "", recents: [] },
  tools: { askBeforeTools: true, perTool: {} },
  routing: { rules: DEFAULT_ROUTING_RULES, fallbackModels: [], maxRetries: 2 },
  updater: { feedUrl: "", token: "", channel: "stable" },
};

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return SECRET_MASK;
  return `${secret.slice(0, 4)}${SECRET_MASK}${secret.slice(-4)}`;
}

export function isMasked(value: string): boolean {
  return value.includes(SECRET_MASK);
}

export interface ResolvedSettings {
  provider: string;
  model: string;
  usingMock: boolean;
  configPath: string;
  profile: ProjectProfileInfo;
}
