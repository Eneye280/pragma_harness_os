import { describe, expect, it } from "vitest";
import { migrateSettingsV1_0_2 } from "../v1_0_2";
import { DEFAULT_SETTINGS } from "../../../shared/settings";

const V1_0_1 = {
  ...structuredClone(DEFAULT_SETTINGS),
  agent: "backend-api",
  integrations: undefined,
} as unknown as Record<string, unknown>;

describe("config migration v1.0.1 → v1.0.2", () => {
  it("adds the integrations block preserving existing values", () => {
    const result = migrateSettingsV1_0_2(V1_0_1 as never);
    expect(result.changed).toBe(true);
    expect(result.to).toBe(3);
    expect(result.settings.agent).toBe("backend-api");
    expect(result.settings.integrations.supabase).toEqual({ url: "", anonKey: "", enabled: false });
    expect(result.settings.integrations.mcpServers).toEqual([]);
  });

  it("keeps provided integrations and is idempotent", () => {
    const withIntegrations = { ...V1_0_1, integrations: { supabase: { url: "https://x.supabase.co", anonKey: "anon", enabled: true }, mcpServers: [{ name: "m", url: "https://m", enabled: true }] } };
    const first = migrateSettingsV1_0_2(withIntegrations as never);
    expect(first.settings.integrations.supabase.enabled).toBe(true);
    const second = migrateSettingsV1_0_2({ ...first.settings, configVersion: first.to } as never);
    expect(second.changed).toBe(false);
    expect(second.settings.integrations.supabase.url).toBe("https://x.supabase.co");
  });
});
