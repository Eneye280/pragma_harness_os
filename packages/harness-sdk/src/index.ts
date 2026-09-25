export type PluginStage = "pre-classify" | "pre-compile" | "pre-agent" | "post-agent";

export interface PluginContext {
  message: string;
  normalized: string;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
  intent?: { domain: string; type: string; effort: string; needs: string[]; confidence: number };
  timestamp: number;
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
