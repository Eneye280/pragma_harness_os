import type { HarnessPlugin, PluginContext, PluginResult } from "../../src/main/harness/plugin-chain";

export const templatePlugin: HarnessPlugin = {
  name: "template",
  version: "0.1.0",
  stage: "pre-agent",
  priority: 100,
  async hook(ctx: PluginContext): Promise<PluginResult> {
    if (!ctx.normalized) return { action: "pass" };
    return { action: "pass" };
  },
};

export default templatePlugin;
