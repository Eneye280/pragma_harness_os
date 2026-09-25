export type PluginStage = "pre-classify" | "pre-compile" | "pre-agent" | "post-agent";
export interface PluginContext {
  message: string;
  normalized: string;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
  intent?: { domain: string; type: string; effort: string; needs: string[]; confidence: number };
  timestamp: number;
  diff?: string;
  filesChanged?: string[];
  gitClean?: boolean;
}
export type PluginResult =
  | { action: "pass" }
  | { action: "block"; reason: string }
  | { action: "transform"; message: string; injectContext?: string }
  | { action: "inject-skill"; skillName: string };
export interface HarnessPlugin {
  name: string;
  version: string;
  stage: PluginStage;
  priority: number;
  hook(ctx: PluginContext): Promise<PluginResult>;
}

export interface ChainRunResult {
  finalMessage: string;
  injectedSkills: string[];
  injectedContexts: string[];
  blocked?: { plugin: string; reason: string };
  executed: Array<{ plugin: string; stage: PluginStage; result: PluginResult; durationMs: number }>;
}

export class PluginChain {
  private plugins: HarnessPlugin[] = [];

  register(plugin: HarnessPlugin): void {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => a.priority - b.priority);
  }

  registerMany(plugins: HarnessPlugin[]): void {
    for (const p of plugins) this.register(p);
  }

  getPlugins(stage?: PluginStage): HarnessPlugin[] {
    if (!stage) return [...this.plugins];
    return this.plugins.filter((p) => p.stage === stage);
  }

  clear(): void {
    this.plugins = [];
  }

  async run(ctx: PluginContext, stage?: PluginStage): Promise<ChainRunResult> {
    const target = stage ? this.getPlugins(stage) : this.plugins;
    let finalMessage = ctx.message;
    const injectedSkills: string[] = [];
    const injectedContexts: string[] = [];
    const executed: ChainRunResult["executed"] = [];

    let currentCtx: PluginContext = { ...ctx, message: finalMessage, normalized: finalMessage.trim() };

    for (const plugin of target) {
      const start = Date.now();
      const result = await plugin.hook(currentCtx);
      executed.push({ plugin: plugin.name, stage: plugin.stage, result, durationMs: Date.now() - start });

      if (result.action === "block") {
        return { finalMessage, injectedSkills, injectedContexts, blocked: { plugin: plugin.name, reason: result.reason }, executed };
      }
      if (result.action === "transform") {
        finalMessage = result.message;
        currentCtx = { ...currentCtx, message: finalMessage, normalized: finalMessage.trim() };
        if (result.injectContext) injectedContexts.push(result.injectContext);
      }
      if (result.action === "inject-skill") {
        injectedSkills.push(result.skillName);
      }
    }

    return { finalMessage, injectedSkills, injectedContexts, executed };
  }

  async runAllStages(ctx: PluginContext): Promise<ChainRunResult> {
    const stages: PluginStage[] = ["pre-classify", "pre-compile", "pre-agent", "post-agent"];
    let currentCtx = ctx;
    const allExecuted: ChainRunResult["executed"] = [];
    let finalMessage = ctx.message;
    const injectedSkills: string[] = [];
    const injectedContexts: string[] = [];

    for (const stage of stages) {
      const res = await this.run({ ...currentCtx, message: finalMessage, normalized: finalMessage.trim() }, stage);
      allExecuted.push(...res.executed);
      if (res.blocked) return { finalMessage, injectedSkills: [...injectedSkills, ...res.injectedSkills], injectedContexts: [...injectedContexts, ...res.injectedContexts], blocked: res.blocked, executed: allExecuted };
      finalMessage = res.finalMessage;
      injectedSkills.push(...res.injectedSkills);
      injectedContexts.push(...res.injectedContexts);
      currentCtx = { ...currentCtx, message: finalMessage, normalized: finalMessage.trim() };
    }

    return { finalMessage, injectedSkills, injectedContexts, executed: allExecuted };
  }
}

export const pluginChain = new PluginChain();
