import { describe, expect, it } from "vitest";
import { migrateSettingsV1_0_2_1 } from "../v1_0_2_1";
import { DEFAULT_SETTINGS } from "../../../shared/settings";

const V1_0_2 = { ...structuredClone(DEFAULT_SETTINGS), agent: "unity-gameplay", configVersion: 3 } as unknown as Record<string, unknown>;

describe("config migration v1.0.2 → v1.0.2.1", () => {
  it("seals configVersion 4 preserving the settings", () => {
    const result = migrateSettingsV1_0_2_1(V1_0_2 as never);
    expect(result.to).toBe(4);
    expect(result.changed).toBe(true);
    expect(result.settings.agent).toBe("unity-gameplay");
    expect(result.settings.integrations.mcpServers).toEqual([]);
  });

  it("is idempotent when already migrated", () => {
    const first = migrateSettingsV1_0_2_1(V1_0_2 as never);
    const second = migrateSettingsV1_0_2_1({ ...first.settings, configVersion: first.to } as never);
    expect(second.changed).toBe(false);
    expect(second.settings.agent).toBe("unity-gameplay");
  });
});
