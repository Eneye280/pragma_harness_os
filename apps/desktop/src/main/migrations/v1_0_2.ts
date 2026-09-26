import { DEFAULT_SETTINGS, type HarnessSettings } from "../../shared/settings";

export const CONFIG_SCHEMA_VERSION_V1_0_2 = 3;

export interface MigrationResultV2 {
  settings: HarnessSettings;
  changed: boolean;
  from: number;
  to: number;
}

interface MigratableV2 {
  configVersion?: number;
  integrations?: Partial<HarnessSettings["integrations"]>;
  theme?: unknown;
}

/**
 * Idempotent v1.0.1 → v1.0.2 migration.
 * Adds the third-party integrations block and seals configVersion 3.
 */
export function migrateSettingsV1_0_2(input: MigratableV2): MigrationResultV2 {
  const from = typeof input.configVersion === "number" ? input.configVersion : 2;
  const { configVersion: _version, ...rest } = input;
  void _version;
  const merged: HarnessSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(rest as Partial<HarnessSettings>),
    integrations: {
      supabase: { ...DEFAULT_SETTINGS.integrations.supabase, ...(input.integrations?.supabase ?? {}) },
      mcpServers: input.integrations?.mcpServers ?? [],
    },
  };
  const changed = from < CONFIG_SCHEMA_VERSION_V1_0_2 || !input.integrations;
  return { settings: merged, changed, from, to: CONFIG_SCHEMA_VERSION_V1_0_2 };
}

export function withConfigVersionV2(settings: HarnessSettings): HarnessSettings & { configVersion: number } {
  return { ...settings, configVersion: CONFIG_SCHEMA_VERSION_V1_0_2 };
}
