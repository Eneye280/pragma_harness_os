import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ProviderName = "deepseek" | "anthropic" | "openai" | "ollama" | "mock";

export interface ProviderConfig {
  provider: ProviderName;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  deepseek: "deepseek-chat",
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4o-mini",
  ollama: "llama3.1",
  mock: "mock-model",
};

const DEFAULT_BASE_URLS: Partial<Record<ProviderName, string>> = {
  deepseek: "https://api.deepseek.com/v1",
  ollama: "http://localhost:11434/v1",
};

export function getModelId(config: ProviderConfig): string {
  return config.model ?? DEFAULT_MODELS[config.provider];
}

export function getBaseURL(config: ProviderConfig): string | undefined {
  return config.baseURL ?? DEFAULT_BASE_URLS[config.provider];
}

export function createProvider(config: ProviderConfig) {
  if (config.provider === "mock") return null;
  const baseURL = getBaseURL(config);
  const apiKey = config.apiKey ?? "test-key";
  return createOpenAICompatible({
    name: config.provider,
    baseURL: baseURL!,
    apiKey,
  });
}

export function resolveProviderFromSettings(settings?: { provider?: ProviderName; apiKey?: string; baseURL?: string; model?: string }): ProviderConfig {
  return {
    provider: settings?.provider ?? "deepseek",
    apiKey: settings?.apiKey,
    baseURL: settings?.baseURL,
    model: settings?.model,
  };
}
