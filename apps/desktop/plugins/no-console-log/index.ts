import type { HarnessPlugin, PluginContext, PluginResult } from "../../src/main/harness/plugin-chain";

export function addedLines(diff: string | undefined): string[] {
  if (!diff) return [];
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

export function findConsoleLogs(diff: string | undefined): string[] {
  return addedLines(diff).filter((line) => /\bconsole\.(log|debug)\s*\(/.test(line));
}

export const noConsoleLogPlugin: HarnessPlugin = {
  name: "no-console-log",
  version: "0.1.0",
  stage: "post-agent",
  priority: 10,
  async hook(ctx: PluginContext): Promise<PluginResult> {
    const consoleLogs = findConsoleLogs(ctx.diff);
    if (consoleLogs.length === 0) return { action: "pass" };
    return {
      action: "block",
      reason: `no-console-log: el diff agrega ${consoleLogs.length} console.log. Elimínalos o usa el logger del harness antes de continuar.`,
    };
  },
};
