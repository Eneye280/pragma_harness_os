import { DEFAULT_SETTINGS, type HarnessSettings } from "../../shared/settings";

export const CONFIG_SCHEMA_VERSION_V1_0_2_1 = 4;

export interface MigrationResultV3 {
  settings: HarnessSettings;
  changed: boolean;
  from: number;
  to: number;
}

interface MigratableV3 {
  configVersion?: number;
}

/**
 * Migración idempotente v1.0.2 → v1.0.2.1.
 * No introduce claves nuevas obligatorias: rellena defaults que falten y sella
 * `configVersion: 4`. Repetirla no cambia nada.
 */
export function migrateSettingsV1_0_2_1(input: MigratableV3): MigrationResultV3 {
  const from = typeof input.configVersion === "number" ? input.configVersion : 3;
  const { configVersion: _version, ...rest } = input as MigratableV3 & Record<string, unknown>;
  void _version;
  const merged = { ...structuredClone(DEFAULT_SETTINGS), ...(rest as Partial<HarnessSettings>) } as HarnessSettings;
  merged.integrations = {
    supabase: { ...DEFAULT_SETTINGS.integrations.supabase, ...(merged.integrations?.supabase ?? {}) },
    mcpServers: merged.integrations?.mcpServers ?? [],
  };
  return { settings: merged, changed: from < CONFIG_SCHEMA_VERSION_V1_0_2_1, from, to: CONFIG_SCHEMA_VERSION_V1_0_2_1 };
}

export function withConfigVersionV3(settings: HarnessSettings): HarnessSettings & { configVersion: number } {
  return { ...settings, configVersion: CONFIG_SCHEMA_VERSION_V1_0_2_1 };
}
