import { DEFAULT_SETTINGS, type HarnessSettings } from "../../shared/settings";
import { DEFAULT_ROUTING_RULES } from "../../shared/routing";

export const CONFIG_SCHEMA_VERSION = 2;

export interface MigrationResult {
  settings: HarnessSettings;
  changed: boolean;
  from: number;
  to: number;
}

interface MigratableSettings {
  configVersion?: number;
  provider?: HarnessSettings["provider"];
  budget?: HarnessSettings["budget"];
  gates?: Partial<HarnessSettings["gates"]>;
  plugins?: HarnessSettings["plugins"];
  skills?: HarnessSettings["skills"];
  agent?: string;
  sandbox?: Partial<HarnessSettings["sandbox"]>;
  workspace?: HarnessSettings["workspace"];
  tools?: Partial<HarnessSettings["tools"]>;
  routing?: Partial<HarnessSettings["routing"]>;
  updater?: Partial<HarnessSettings["updater"]>;
}

/**
 * Idempotent v1.0.0 → v1.0.1 config migration.
 * Adds the new settings blocks with defaults, preserving every existing value.
 */
export function migrateSettingsV1_0_1(input: MigratableSettings): MigrationResult {
  const from = typeof input.configVersion === "number" ? input.configVersion : 1;
  const { configVersion: _configVersion, ...rest } = input;
  void _configVersion;
  const merged: HarnessSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...rest,
    provider: { ...DEFAULT_SETTINGS.provider, ...(input.provider ?? {}) },
    budget: { ...DEFAULT_SETTINGS.budget, ...(input.budget ?? {}) },
    gates: {
      pre: { ...DEFAULT_SETTINGS.gates.pre, ...(input.gates?.pre ?? {}) },
      post: { ...DEFAULT_SETTINGS.gates.post, ...(input.gates?.post ?? {}) },
    },
    plugins: { ...DEFAULT_SETTINGS.plugins, ...(input.plugins ?? {}) },
    skills: { ...DEFAULT_SETTINGS.skills, ...(input.skills ?? {}) },
    sandbox: { ...DEFAULT_SETTINGS.sandbox, ...(input.sandbox ?? {}) },
    workspace: { ...DEFAULT_SETTINGS.workspace, ...(input.workspace ?? {}) },
    tools: {
      askBeforeTools: input.tools?.askBeforeTools ?? DEFAULT_SETTINGS.tools.askBeforeTools,
      perTool: { ...DEFAULT_SETTINGS.tools.perTool, ...(input.tools?.perTool ?? {}) },
    },
    routing: {
      rules: input.routing?.rules?.length ? input.routing.rules : DEFAULT_ROUTING_RULES,
      fallbackModels: input.routing?.fallbackModels ?? DEFAULT_SETTINGS.routing.fallbackModels,
      maxRetries: input.routing?.maxRetries ?? DEFAULT_SETTINGS.routing.maxRetries,
    },
    updater: { ...DEFAULT_SETTINGS.updater, ...(input.updater ?? {}) },
  };
  const changed = from < CONFIG_SCHEMA_VERSION || !input.tools || !input.routing || !input.updater || input.sandbox?.network === undefined;
  return { settings: merged, changed, from, to: CONFIG_SCHEMA_VERSION };
}

export function withConfigVersion(settings: HarnessSettings): HarnessSettings & { configVersion: number } {
  return { ...settings, configVersion: CONFIG_SCHEMA_VERSION };
}
