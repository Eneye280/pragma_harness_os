import { describe, expect, it } from "vitest";
import { migrateSettingsV1_0_1 } from "../v1_0_1";
import { DEFAULT_SETTINGS, type HarnessSettings } from "../../../shared/settings";

const LEGACY_V1_0_0 = {
  provider: { provider: "deepseek", apiKey: "sk-keep-me", baseURL: "https://api", models: { classifier: "c", executor: "e" } },
  budget: { tokensPerDay: 1234, usdPerDay: 3 },
  gates: { pre: { enabled: true, secret: true, budget: true, schema: true }, post: { enabled: true, build: true, typecheck: true, lint: true, tests: true, security: true, visual: true } },
  plugins: { "secret-scan": true },
  skills: { "tdd-workflow": true },
  agent: "backend-feature",
  sandbox: { enabled: true, image: "node:20" },
  workspace: { active: "/repo", recents: ["/repo"] },
} as unknown as HarnessSettings;

describe("config migration v1.0.0 → v1.0.1", () => {
  it("preserves existing values and adds the new blocks", () => {
    const result = migrateSettingsV1_0_1({ ...LEGACY_V1_0_0 });
    expect(result.from).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.settings.provider.apiKey).toBe("sk-keep-me");
    expect(result.settings.budget.tokensPerDay).toBe(1234);
    expect(result.settings.skills).toEqual({ "tdd-workflow": true });
    expect(result.settings.agent).toBe("backend-feature");
    expect(result.settings.sandbox.enabled).toBe(true);
    expect(result.settings.sandbox.image).toBe("node:20");
    expect(result.settings.sandbox.readOnlyWorkspace).toBe(DEFAULT_SETTINGS.sandbox.readOnlyWorkspace);
    expect(result.settings.tools.askBeforeTools).toBe(DEFAULT_SETTINGS.tools.askBeforeTools);
    expect(result.settings.routing.fallbackModels).toEqual([]);
    expect(result.settings.updater.channel).toBe("stable");
  });

  it("is idempotent once migrated", () => {
    const first = migrateSettingsV1_0_1({ ...LEGACY_V1_0_0 });
    const second = migrateSettingsV1_0_1({ ...first.settings, configVersion: first.to } as never);
    expect(second.changed).toBe(false);
    expect(JSON.stringify(second.settings, null, 2)).toBe(JSON.stringify(first.settings, null, 2));
  });

  it("keeps user routing rules and tools overrides when present", () => {
    const result = migrateSettingsV1_0_1({
      ...LEGACY_V1_0_0,
      tools: { askBeforeTools: false, perTool: { terminal: "deny" } },
      routing: { rules: [{ id: "custom", when: { domain: "unity" }, model: "unity-model" }], fallbackModels: ["backup"], maxRetries: 1 },
      configVersion: 1,
    } as never);
    expect(result.settings.tools.askBeforeTools).toBe(false);
    expect(result.settings.tools.perTool.terminal).toBe("deny");
    expect(result.settings.routing.rules[0].id).toBe("custom");
    expect(result.settings.routing.fallbackModels).toEqual(["backup"]);
    expect(result.settings.routing.maxRetries).toBe(1);
  });
});
