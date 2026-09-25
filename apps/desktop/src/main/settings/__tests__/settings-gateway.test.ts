import { describe, it, expect } from "vitest";
import { SettingsController, SettingsGateway, resolveGatewayConfig } from "../index";
import { SettingsStore } from "../settings-store";
import { DEFAULT_SETTINGS, type HarnessSettings } from "../../../shared/settings";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { ChatGateway } from "../../chat/chat-service";
import type { ResolvedGatewayConfig } from "../index";

function makeSettings(overrides: Partial<HarnessSettings["provider"]>): HarnessSettings {
  return { ...structuredClone(DEFAULT_SETTINGS), provider: { ...DEFAULT_SETTINGS.provider, ...overrides } };
}

function makeRecordingGateway(seen: ResolvedGatewayConfig[]): (config: ResolvedGatewayConfig) => ChatGateway {
  return (config) => {
    seen.push(config);
    return {
      // eslint-disable-next-line require-yield
      stream: async function* () {
        yield { textDelta: `provider=${config.provider};model=${config.model}`, isDone: false };
        yield { textDelta: "", isDone: true };
      },
    };
  };
}

async function drain(gateway: ChatGateway): Promise<string> {
  let text = "";
  for await (const chunk of gateway.stream("ping")) {
    if (!chunk.isDone) text += chunk.textDelta;
  }
  return text;
}

describe("SettingsGateway", () => {
  it("resolves the executor model and base URL", () => {
    const config = resolveGatewayConfig(
      makeSettings({ provider: "anthropic", apiKey: "k", baseURL: "https://proxy", models: { classifier: "haiku", executor: "sonnet" } })
    );
    expect(config).toEqual({ provider: "anthropic", apiKey: "k", baseURL: "https://proxy", model: "sonnet" });
  });

  it("uses the newly selected provider on the next call (BYOK switch)", async () => {
    const seen: ResolvedGatewayConfig[] = [];
    let current = makeSettings({ provider: "deepseek", apiKey: "d", models: { classifier: "deepseek-chat", executor: "deepseek-chat" } });
    const gateway = new SettingsGateway(() => current, makeRecordingGateway(seen));

    expect(await drain(gateway)).toContain("provider=deepseek");
    current = makeSettings({ provider: "anthropic", apiKey: "a", models: { classifier: "haiku", executor: "claude-3-5-sonnet" } });
    expect(await drain(gateway)).toContain("provider=anthropic");

    expect(seen[0].provider).toBe("deepseek");
    expect(seen[1].provider).toBe("anthropic");
    expect(seen[1].model).toBe("claude-3-5-sonnet");
  });

  it("throws a clear error when a real provider has no api key instead of answering empty", () => {
    const gateway = new SettingsGateway(
      () => makeSettings({ provider: "anthropic", apiKey: "" }),
      makeRecordingGateway([])
    );
    expect(() => gateway.stream("ping")).toThrow(/requiere apiKey/);
  });
});

describe("SettingsController", () => {
  it("reports the resolved provider and validates a mock provider without keys", async () => {
    const store = new SettingsStore(join(mkdtempSync(join(tmpdir(), "phs22-ctrl-")), "config.json"));
    const controller = new SettingsController(store);
    expect(controller.resolved().provider).toBe("mock");
    expect(await controller.testProvider()).toEqual({ ok: true, reason: "provider mock siempre disponible" });
  });

  it("requires an api key for non-mock providers", async () => {
    const store = new SettingsStore(join(mkdtempSync(join(tmpdir(), "phs22-ctrl-")), "config.json"));
    const controller = new SettingsController(store);
    controller.update({ ...store.get(), provider: { ...store.get().provider, provider: "openai", apiKey: "" } });
    const result = await controller.testProvider();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/apiKey/);
  });
});
