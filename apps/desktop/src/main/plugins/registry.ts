import type { HarnessPlugin, PluginContext, PluginStage } from "../harness/plugin-chain";
import { commitGuardPlugin } from "../../../plugins/commit-guard";
import { secretScanPlugin } from "../../../plugins/secret-scan";
import { noConsoleLogPlugin } from "../../../plugins/no-console-log";

export const SEED_PLUGINS: HarnessPlugin[] = [commitGuardPlugin, secretScanPlugin, noConsoleLogPlugin];

export interface PluginBlockResult {
  blocked?: { plugin: string; reason: string };
}

export interface PluginRunner {
  runPreAgent(context: PluginContext): Promise<PluginBlockResult>;
  runPostAgent(context: PluginContext): Promise<PluginBlockResult>;
}

export class SeedPluginRunner implements PluginRunner {
  constructor(
    private readonly plugins: HarnessPlugin[] = SEED_PLUGINS,
    private readonly isEnabled: (name: string) => boolean = () => true
  ) {}

  private async runStage(stage: PluginStage, context: PluginContext): Promise<PluginBlockResult> {
    const active = this.plugins
      .filter((plugin) => plugin.stage === stage && this.isEnabled(plugin.name))
      .sort((left, right) => left.priority - right.priority);

    for (const plugin of active) {
      try {
        const result = await plugin.hook(context);
        if (result.action === "block") return { blocked: { plugin: plugin.name, reason: result.reason } };
      } catch {
        continue;
      }
    }
    return {};
  }

  runPreAgent(context: PluginContext): Promise<PluginBlockResult> {
    return this.runStage("pre-agent", context);
  }

  runPostAgent(context: PluginContext): Promise<PluginBlockResult> {
    return this.runStage("post-agent", context);
  }
}

export function createPluginRunner(
  isEnabled: (name: string) => boolean,
  customPlugins: () => HarnessPlugin[] = () => []
): PluginRunner {
  const plugins = [...SEED_PLUGINS];
  return {
    async runPreAgent(context: PluginContext): Promise<PluginBlockResult> {
      return new SeedPluginRunner([...plugins, ...customPlugins()], isEnabled).runPreAgent(context);
    },
    async runPostAgent(context: PluginContext): Promise<PluginBlockResult> {
      return new SeedPluginRunner([...plugins, ...customPlugins()], isEnabled).runPostAgent(context);
    },
  };
}
