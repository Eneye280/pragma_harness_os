import type { ChatGateway } from "../chat/chat-service";
import type { HarnessSettings, ProviderName } from "../../shared/settings";
import { SettingsStore } from "./settings-store";

export { SettingsStore, SettingsSchema, resolveSettingsPath, settingsForLogging } from "./settings-store";

export interface ResolvedGatewayConfig {
  provider: ProviderName;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export function resolveGatewayConfig(settings: HarnessSettings): ResolvedGatewayConfig {
  return {
    provider: settings.provider.provider,
    apiKey: settings.provider.apiKey,
    baseURL: settings.provider.baseURL || undefined,
    model: settings.provider.models.executor,
  };
}

export class SettingsGateway implements ChatGateway {
  constructor(
    private readonly readSettings: () => HarnessSettings,
    private readonly factory: (config: ResolvedGatewayConfig) => ChatGateway
  ) {}

  stream(prompt: string): AsyncGenerator<{ textDelta: string; isDone: boolean }> {
    const config = resolveGatewayConfig(this.readSettings());
    if (config.provider !== "mock" && !config.apiKey) {
      throw new Error(`provider "${config.provider}" requiere apiKey — configúralo en Settings`);
    }
    return this.factory(config).stream(prompt);
  }

  resolved(): { provider: ProviderName; model: string; usingMock: boolean } {
    const settings = this.readSettings();
    return {
      provider: settings.provider.provider,
      model: settings.provider.models.executor,
      usingMock: settings.provider.provider === "mock",
    };
  }
}

export interface ProviderProbeResult {
  ok: boolean;
  reason: string;
}

export type ProviderProbe = (config: ResolvedGatewayConfig) => Promise<ProviderProbeResult>;

export class SettingsController {
  constructor(
    readonly store: SettingsStore,
    private readonly probe?: ProviderProbe
  ) {}

  get() {
    return this.store.getPublic();
  }

  update(incoming: HarnessSettings) {
    this.store.update(incoming);
    return this.store.getPublic();
  }

  resolved() {
    const settings = this.store.get();
    return {
      provider: settings.provider.provider,
      model: settings.provider.models.executor,
      usingMock: settings.provider.provider === "mock",
      configPath: this.store.file,
    };
  }

  async testProvider(): Promise<ProviderProbeResult> {
    const config = resolveGatewayConfig(this.store.get());
    if (config.provider === "mock") return { ok: true, reason: "provider mock siempre disponible" };
    if (!config.apiKey) return { ok: false, reason: "apiKey requerido para este provider" };
    if (this.probe) return this.probe(config);
    return { ok: true, reason: `config lista para ${config.provider}` };
  }
}
