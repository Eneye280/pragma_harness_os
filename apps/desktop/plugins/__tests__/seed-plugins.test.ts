import { describe, it, expect } from "vitest";
import { createCommitGuardPlugin } from "../commit-guard";
import { findSecrets, secretScanPlugin } from "../secret-scan";
import { findConsoleLogs, noConsoleLogPlugin } from "../no-console-log";
import type { PluginContext } from "../../src/main/harness/plugin-chain";

function context(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    message: "hola",
    normalized: "hola",
    sessionId: "s1",
    workspaceHash: "h",
    workspacePath: "/ws",
    timestamp: 1,
    ...overrides,
  };
}

describe("commit-guard plugin", () => {
  it("blocks when the workspace has uncommitted changes", async () => {
    const plugin = createCommitGuardPlugin({ isDirty: async () => true });
    const result = await plugin.hook(context());
    expect(result.action).toBe("block");
  });

  it("passes on a clean workspace and with an explicit gitClean override", async () => {
    const plugin = createCommitGuardPlugin({ isDirty: async () => false });
    expect((await plugin.hook(context())).action).toBe("pass");
    expect((await plugin.hook(context({ gitClean: true }))).action).toBe("pass");
    const dirtyPlugin = createCommitGuardPlugin({ isDirty: async () => false });
    expect((await dirtyPlugin.hook(context({ gitClean: false }))).action).toBe("block");
  });
});

describe("secret-scan plugin", () => {
  it("detects common secret shapes", () => {
    expect(findSecrets("usa sk-abcdefgh12345678").length).toBeGreaterThan(0);
    expect(findSecrets("ghp_abcdefgh12345678").length).toBeGreaterThan(0);
    expect(findSecrets("password=SuperSecret1").length).toBeGreaterThan(0);
    expect(findSecrets("texto limpio")).toEqual([]);
  });

  it("blocks on a secret in the message or the diff", async () => {
    expect((await secretScanPlugin.hook(context({ message: "key sk-abcdefgh12345678" }))).action).toBe("block");
    expect((await secretScanPlugin.hook(context({ diff: "+ const k = 'ghp_abcdefgh12345678'" }))).action).toBe("block");
    expect((await secretScanPlugin.hook(context())).action).toBe("pass");
  });
});

describe("no-console-log plugin", () => {
  it("blocks only on added console.log lines", async () => {
    expect((await noConsoleLogPlugin.hook(context({ diff: "+ console.log('debug')" }))).action).toBe("block");
    expect((await noConsoleLogPlugin.hook(context({ diff: "- console.log('removed')" }))).action).toBe("pass");
    expect((await noConsoleLogPlugin.hook(context({ diff: "+ const ok = 1" }))).action).toBe("pass");
    expect(findConsoleLogs("+ console.debug('x')").length).toBe(1);
  });
});
