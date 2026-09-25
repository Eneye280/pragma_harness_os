import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DEFAULT_SETTINGS } from "../../../shared/settings";
import { resolveEffectiveSettings } from "../effective";
import { ProjectProfileStore } from "../store";
import { SettingsStore } from "../../settings";

const globalSettings = structuredClone(DEFAULT_SETTINGS);
globalSettings.provider = { provider: "deepseek", apiKey: "sk-global", baseURL: "https://global", models: { classifier: "c", executor: "e" } };
globalSettings.budget = { tokensPerDay: 200000, usdPerDay: 5 };
globalSettings.gates.pre.secret = true;
globalSettings.gates.post.tests = true;
globalSettings.workspace = { active: "C:/ws", recents: ["C:/ws"] };

describe("resolveEffectiveSettings", () => {
  it("returns the global settings when there is no profile", () => {
    expect(resolveEffectiveSettings(globalSettings, null)).toEqual(globalSettings);
  });

  it("lets two different profiles resolve different providers and gates", () => {
    const backendProfile = { provider: { provider: "anthropic" as const }, gates: { pre: { secret: false }, post: { tests: false } } };
    const engineProfile = { provider: { provider: "ollama" as const, baseURL: "http://localhost:11434" }, gates: { post: { tests: true } } };

    const backend = resolveEffectiveSettings(globalSettings, backendProfile);
    const engine = resolveEffectiveSettings(globalSettings, engineProfile);

    expect(backend.provider.provider).toBe("anthropic");
    expect(engine.provider.provider).toBe("ollama");
    expect(engine.provider.baseURL).toBe("http://localhost:11434");
    expect(backend.gates.pre.secret).toBe(false);
    expect(engine.gates.pre.secret).toBe(true);
    expect(backend.gates.post.tests).toBe(false);
    expect(engine.gates.post.tests).toBe(true);
  });

  it("keeps the global apiKey and workspace even if the profile overrides provider", () => {
    const effective = resolveEffectiveSettings(globalSettings, { provider: { provider: "openai" }, plugins: { "no-console-log": false } });
    expect(effective.provider.apiKey).toBe("sk-global");
    expect(effective.workspace).toEqual({ active: "C:/ws", recents: ["C:/ws"] });
    expect(effective.plugins["no-console-log"]).toBe(false);
  });

  it("does not mutate the global settings object", () => {
    resolveEffectiveSettings(globalSettings, { provider: { provider: "mock" } });
    expect(globalSettings.provider.provider).toBe("deepseek");
  });
});

describe("ProjectProfileStore", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "phs35-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns null when there is no profile", () => {
    const store = new ProjectProfileStore();
    expect(store.read(root)).toBeNull();
    expect(store.info(root).active).toBe(false);
  });

  it("writes, reads back and clears a profile", () => {
    const store = new ProjectProfileStore();
    const written = store.write(root, { name: "backend", gates: { post: { tests: false } } });
    expect(written.active).toBe(true);
    expect(written.name).toBe("backend");
    expect(store.read(root)).toMatchObject({ name: "backend", gates: { post: { tests: false } } });

    const cleared = store.clear(root);
    expect(cleared.active).toBe(false);
    expect(store.read(root)).toBeNull();
  });

  it("rejects a profile with an unknown provider", () => {
    const store = new ProjectProfileStore();
    mkdirSync(join(root, ".pragma-harness"), { recursive: true });
    writeFileSync(join(root, ".pragma-harness", "profile.json"), JSON.stringify({ provider: { provider: "unity" } }), "utf8");
    expect(store.read(root)).toBeNull();
  });

  it("ignores an invalid profile file", () => {
    const store = new ProjectProfileStore();
    mkdirSync(join(root, ".pragma-harness"), { recursive: true });
    writeFileSync(join(root, ".pragma-harness", "profile.json"), "{ not json", "utf8");
    expect(store.read(root)).toBeNull();
    expect(store.info(root).active).toBe(false);
  });
});

describe("SettingsStore with a project profile", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "phs35-settings-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns effective settings and keeps the global file untouched", () => {
    const store = new SettingsStore(join(root, "config.json"));
    store.update({ ...store.getGlobal(), provider: { ...store.getGlobal().provider, provider: "anthropic" } });

    store.useProfile(() => ({ provider: { provider: "ollama" }, gates: { pre: { secret: false } } }));

    expect(store.get().provider.provider).toBe("ollama");
    expect(store.get().gates.pre.secret).toBe(false);
    expect(store.getGlobal().provider.provider).toBe("anthropic");
    expect(store.getGlobal().gates.pre.secret).toBe(true);
  });
});
