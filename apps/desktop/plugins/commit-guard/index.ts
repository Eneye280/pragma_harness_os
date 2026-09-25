import { simpleGit } from "simple-git";
import type { HarnessPlugin, PluginContext, PluginResult } from "../../src/main/harness/plugin-chain";

export interface CommitGuardDeps {
  isDirty?: (workspacePath: string) => Promise<boolean>;
}

async function defaultIsDirty(workspacePath: string): Promise<boolean> {
  try {
    const status = await simpleGit(workspacePath).status();
    return status.modified.length > 0 || status.staged.length > 0;
  } catch {
    return false;
  }
}

export function createCommitGuardPlugin(deps: CommitGuardDeps = {}): HarnessPlugin {
  const isDirty = deps.isDirty ?? defaultIsDirty;
  return {
    name: "commit-guard",
    version: "0.1.0",
    stage: "pre-agent",
    priority: 10,
    async hook(ctx: PluginContext): Promise<PluginResult> {
      const dirty = ctx.gitClean === undefined ? await isDirty(ctx.workspacePath) : !ctx.gitClean;
      if (!dirty) return { action: "pass" };
      return {
        action: "block",
        reason:
          "commit-guard: hay archivos modificados sin commitear en el workspace. Haz commit o stash antes de que el agente edite, para que el diff sea trazable.",
      };
    },
  };
}

export const commitGuardPlugin = createCommitGuardPlugin();
