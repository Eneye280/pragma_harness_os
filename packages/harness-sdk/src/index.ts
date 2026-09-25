export interface HarnessPlugin {
  name: string;
  version: string;
  stage: "pre-classify" | "pre-compile" | "pre-agent" | "post-agent";
  priority: number;
  hook(ctx: unknown): Promise<{ action: "pass" | "block" | "transform" | "inject-skill"; reason?: string }>;
}
