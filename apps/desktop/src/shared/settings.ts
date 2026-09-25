import type { ProjectProfileInfo } from "./profile";

export type ProviderName = "mock" | "deepseek" | "anthropic" | "openai" | "ollama";

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
}

export interface WorkspaceSettings {
  active: string;
  recents: string[];
}

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
  sandbox: SandboxFlags;
  workspace: WorkspaceSettings;
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
  sandbox: { enabled: false, image: "node:22" },
  workspace: { active: "", recents: [] },
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
