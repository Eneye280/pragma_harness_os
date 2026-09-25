import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SettingsStore, sanitizeIncoming, settingsForLogging } from "../settings-store";
import { DEFAULT_SETTINGS, isMasked, maskSecret, type HarnessSettings } from "../../../shared/settings";

let dir = "";
let configPath = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "phs22-"));
  configPath = join(dir, "config.json");
});

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("SettingsStore", () => {
  it("falls back to defaults when the config file is missing", () => {
    const store = new SettingsStore(configPath);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(existsSync(configPath)).toBe(false);
  });

  it("persists updates to ~/.pragma-harness/config.json and reloads them", () => {
    const store = new SettingsStore(configPath);
    const next: HarnessSettings = {
      ...store.get(),
      provider: { ...store.get().provider, provider: "anthropic", apiKey: "sk-ant-secret-1234", models: { classifier: "claude-3-5-haiku", executor: "claude-3-5-sonnet" } },
    };
    store.update(next);
    expect(existsSync(configPath)).toBe(true);
    const reloaded = new SettingsStore(configPath);
    expect(reloaded.get().provider.provider).toBe("anthropic");
    expect(reloaded.get().provider.apiKey).toBe("sk-ant-secret-1234");
    expect(JSON.parse(readFileSync(configPath, "utf8")).provider.models.executor).toBe("claude-3-5-sonnet");
  });

  it("masks the api key in the public view but keeps it internally", () => {
    const store = new SettingsStore(configPath);
    store.update({ ...store.get(), provider: { ...store.get().provider, apiKey: "sk-abcdefgh-9999" } });
    expect(store.get().provider.apiKey).toBe("sk-abcdefgh-9999");
    expect(isMasked(store.getPublic().provider.apiKey)).toBe(true);
    expect(store.getPublic().provider.apiKey).not.toBe("sk-abcdefgh-9999");
  });

  it("does not overwrite the stored key when the incoming key is still masked", () => {
    const store = new SettingsStore(configPath);
    store.update({ ...store.get(), provider: { ...store.get().provider, apiKey: "sk-original-key-0000" } });
    const publicSettings = store.getPublic();
    store.update({ ...publicSettings, provider: { ...publicSettings.provider, apiKey: maskSecret("sk-original-key-0000") } });
    expect(store.get().provider.apiKey).toBe("sk-original-key-0000");
  });

  it("replaces the key when a fresh unmasked key arrives", () => {
    const store = new SettingsStore(configPath);
    store.update({ ...store.get(), provider: { ...store.get().provider, apiKey: "sk-old-key-1111" } });
    store.update({ ...store.get(), provider: { ...store.get().provider, apiKey: "sk-new-key-2222" } });
    expect(store.get().provider.apiKey).toBe("sk-new-key-2222");
  });

  it("rejects invalid settings", () => {
    const store = new SettingsStore(configPath);
    const invalid = { ...store.get(), provider: { ...store.get().provider, provider: "planets" } } as unknown as HarnessSettings;
    expect(() => store.update(invalid)).toThrow(/settings inválidos/);
  });

  it("sanitizes incoming settings and never logs the raw secret", () => {
    const current = { ...DEFAULT_SETTINGS, provider: { ...DEFAULT_SETTINGS.provider, apiKey: "sk-current-0000" } };
    const incoming = { ...DEFAULT_SETTINGS, provider: { ...DEFAULT_SETTINGS.provider, apiKey: "••••••••" } };
    expect(sanitizeIncoming(current, incoming).provider.apiKey).toBe("sk-current-0000");
    expect(JSON.stringify(settingsForLogging(current))).not.toContain("sk-current-0000");
  });
});
