import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { dirname, join } from "path";
import { z } from "zod";
import {
  DEFAULT_SETTINGS,
  KNOWN_PROVIDERS,
  isMasked,
  maskSecret,
  type HarnessSettings,
} from "../../shared/settings";
import type { ProjectProfile } from "../../shared/profile";
import { resolveEffectiveSettings } from "../profile/effective";
import { migrateSettingsV1_0_1 } from "../migrations/v1_0_1";
import { resolveSecretBox } from "../security/key";
import { migrateSettingsV1_0_2 } from "../migrations/v1_0_2";
import { migrateSettingsV1_0_2_1, withConfigVersionV3 } from "../migrations/v1_0_2_1";
import type { SecretBox } from "../security/crypto";

const ProviderSchema = z.object({
  provider: z.enum(["mock", "deepseek", "anthropic", "openai", "ollama"]),
  apiKey: z.string().default(""),
  baseURL: z.string().default(""),
  models: z
    .object({ classifier: z.string().default("deepseek-chat"), executor: z.string().default("deepseek-chat") })
    .default({ classifier: "deepseek-chat", executor: "deepseek-chat" }),
});

const PreGateSchema = z.object({
  enabled: z.boolean(),
  secret: z.boolean(),
  budget: z.boolean(),
  schema: z.boolean(),
});

const PostGateSchema = z.object({
  enabled: z.boolean(),
  build: z.boolean(),
  typecheck: z.boolean(),
  lint: z.boolean(),
  tests: z.boolean(),
  security: z.boolean(),
  visual: z.boolean(),
});

export const SettingsSchema = z.object({
  provider: ProviderSchema,
  budget: z.object({ tokensPerDay: z.number().int().nonnegative(), usdPerDay: z.number().nonnegative() }),
  gates: z.object({ pre: PreGateSchema, post: PostGateSchema }),
  plugins: z.record(z.boolean()),
  skills: z.record(z.boolean()).default({}),
  agent: z.string().default(""),
  sandbox: z.object({
    enabled: z.boolean(),
    image: z.string(),
    network: z.boolean().default(false),
    cpus: z.number().positive().default(1),
    memoryMb: z.number().int().positive().default(1024),
    readOnlyWorkspace: z.boolean().default(true),
  }),
  workspace: z.object({ active: z.string().default(""), recents: z.array(z.string()).default([]) }).default({ active: "", recents: [] }),
  tools: z
    .object({
      askBeforeTools: z.boolean().default(true),
      perTool: z.record(z.enum(["allow", "ask", "deny"])).default({}),
    })
    .default({ askBeforeTools: true, perTool: {} }),
  routing: z
    .object({
      rules: z
        .array(
          z.object({
            id: z.string(),
            when: z.object({ domain: z.string().optional(), type: z.string().optional(), effort: z.string().optional() }),
            model: z.string(),
          })
        )
        .default([]),
      fallbackModels: z.array(z.string()).default([]),
      maxRetries: z.number().int().min(0).max(5).default(2),
    })
    .default({ rules: [], fallbackModels: [], maxRetries: 2 }),
  integrations: z
    .object({
      supabase: z.object({ url: z.string().default(""), anonKey: z.string().default(""), enabled: z.boolean().default(false) }).default({ url: "", anonKey: "", enabled: false }),
      mcpServers: z.array(z.object({ name: z.string(), url: z.string(), enabled: z.boolean() })).default([]),
    })
    .default({ supabase: { url: "", anonKey: "", enabled: false }, mcpServers: [] }),
  updater: z
    .object({
      feedUrl: z.string().default(""),
      token: z.string().default(""),
      channel: z.enum(["stable", "beta"]).default("stable"),
    })
    .default({ feedUrl: "", token: "", channel: "stable" }),
});

export function resolveSettingsPath(): string {
  const configuredPath = process.env["HARNESS_CONFIG_PATH"];
  if (configuredPath) return configuredPath;
  try {
    const base = join(homedir(), ".pragma-harness");
    return join(base, "config.json");
  } catch {
    return join(tmpdir(), "pragma-harness", "config.json");
  }
}

export function sanitizeIncoming(current: HarnessSettings, incoming: HarnessSettings): HarnessSettings {
  const incomingKey = incoming.provider.apiKey ?? "";
  const apiKey = incomingKey && !isMasked(incomingKey) ? incomingKey : current.provider.apiKey;
  return {
    provider: { ...incoming.provider, apiKey },
    budget: incoming.budget,
    gates: incoming.gates,
    plugins: incoming.plugins,
    skills: incoming.skills ?? current.skills,
    agent: incoming.agent ?? current.agent,
    sandbox: incoming.sandbox,
    workspace: incoming.workspace ?? current.workspace,
    tools: incoming.tools ?? current.tools,
    routing: incoming.routing ?? current.routing,
    updater: incoming.updater ?? current.updater,
    integrations: incoming.integrations ?? current.integrations,
  };
}

export class SettingsStore {
  private settings: HarnessSettings;
  private profileProvider: (() => ProjectProfile | null) | null = null;
  private secretBox: SecretBox;

  constructor(private readonly filePath: string = resolveSettingsPath()) {
    this.secretBox = resolveSecretBox(this.filePath);
    this.settings = this.load();
  }

  useProfile(provider: () => ProjectProfile | null): void {
    this.profileProvider = provider;
  }

  private load(): HarnessSettings {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_SETTINGS);
    try {
      const parsedJson = JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, unknown>;
      const rawVersion = typeof parsedJson["configVersion"] === "number" ? (parsedJson["configVersion"] as number) : undefined;
      const migration = migrateSettingsV1_0_1({ ...(parsedJson as object), configVersion: rawVersion } as never);
      const validated = SettingsSchema.safeParse(migration.settings);
      if (!validated.success) return structuredClone(DEFAULT_SETTINGS);
      const settings = validated.data as HarnessSettings;
      if (settings.provider.apiKey) {
        settings.provider.apiKey = this.secretBox.decrypt(settings.provider.apiKey);
      }
      const migrationV2 = migrateSettingsV1_0_2({ ...(settings as object), configVersion: migration.to } as never);
      const migrationV3 = migrateSettingsV1_0_2_1({ ...(migrationV2.settings as object), configVersion: migrationV2.to } as never);
      const changed = migration.changed || migrationV2.changed || migrationV3.changed || rawVersion !== migrationV3.to;
      if (changed) {
        this.settings = migrationV3.settings;
        this.persist();
      }
      return migrationV3.settings;
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  get(): HarnessSettings {
    const base = structuredClone(this.settings);
    const profile = this.profileProvider?.() ?? null;
    return profile ? resolveEffectiveSettings(base, profile) : base;
  }

  getGlobal(): HarnessSettings {
    return structuredClone(this.settings);
  }

  getPublic(): HarnessSettings {
    const publicSettings = this.get();
    publicSettings.provider.apiKey = maskSecret(publicSettings.provider.apiKey);
    return publicSettings;
  }

  update(incoming: HarnessSettings): HarnessSettings {
    const merged = sanitizeIncoming(this.settings, incoming);
    const result = SettingsSchema.safeParse(merged);
    if (!result.success) {
      throw new Error(`settings inválidos: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    this.settings = result.data as HarnessSettings;
    this.persist();
    return this.get();
  }

  updateWorkspace(workspace: HarnessSettings["workspace"]): HarnessSettings {
    this.settings = { ...this.settings, workspace: { active: workspace.active, recents: [...workspace.recents] } };
    this.persist();
    return this.get();
  }

  updateSkills(skills: Record<string, boolean>): HarnessSettings {
    this.settings = { ...this.settings, skills: { ...skills } };
    this.persist();
    return this.get();
  }

  updatePlugins(plugins: Record<string, boolean>): HarnessSettings {
    this.settings = { ...this.settings, plugins: { ...plugins } };
    this.persist();
    return this.get();
  }

  updateTools(tools: HarnessSettings["tools"]): HarnessSettings {
    this.settings = { ...this.settings, tools: { ...tools, perTool: { ...tools.perTool } } };
    this.persist();
    return this.get();
  }

  updateAgent(agent: string): HarnessSettings {
    this.settings = { ...this.settings, agent };
    this.persist();
    return this.get();
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const toPersist = withConfigVersionV3(this.settings);
    const apiKey = toPersist.provider.apiKey;
    const payload = {
      ...toPersist,
      provider: { ...toPersist.provider, apiKey: this.secretBox.encrypt(apiKey) },
    };
    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }

  get file(): string {
    return this.filePath;
  }
}

export function settingsForLogging(settings: HarnessSettings): Record<string, unknown> {
  return {
    provider: settings.provider.provider,
    apiKey: maskSecret(settings.provider.apiKey),
    models: settings.provider.models,
    budget: settings.budget,
    gates: settings.gates,
    plugins: settings.plugins,
    sandbox: settings.sandbox,
  };
}

export const KNOWN_PROVIDER_NAMES = KNOWN_PROVIDERS;
