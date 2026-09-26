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
  sandbox: z.object({ enabled: z.boolean(), image: z.string() }),
  workspace: z.object({ active: z.string().default(""), recents: z.array(z.string()).default([]) }).default({ active: "", recents: [] }),
  tools: z
    .object({
      askBeforeTools: z.boolean().default(true),
      perTool: z.record(z.enum(["allow", "ask", "deny"])).default({}),
    })
    .default({ askBeforeTools: true, perTool: {} }),
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
  };
}

export class SettingsStore {
  private settings: HarnessSettings;
  private profileProvider: (() => ProjectProfile | null) | null = null;

  constructor(private readonly filePath: string = resolveSettingsPath()) {
    this.settings = this.load();
  }

  useProfile(provider: () => ProjectProfile | null): void {
    this.profileProvider = provider;
  }

  private load(): HarnessSettings {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_SETTINGS);
    try {
      const parsedJson: unknown = JSON.parse(readFileSync(this.filePath, "utf8"));
      const result = SettingsSchema.safeParse(parsedJson);
      if (!result.success) return structuredClone(DEFAULT_SETTINGS);
      return result.data as HarnessSettings;
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
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
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
