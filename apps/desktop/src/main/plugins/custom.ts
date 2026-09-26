import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import type { HarnessPlugin, PluginContext, PluginResult } from "../harness/plugin-chain";
import {
  customPluginDefToJson,
  parseCustomPluginJson,
  validateCustomPlugin,
  type CustomPluginDef,
} from "../../shared/plugin-authoring";
import { PROFILE_DIRECTORY } from "../../shared/profile";

const PLUGINS_DIRECTORY = "plugins";

export function customPluginPath(workspacePath: string, name: string): string {
  return join(workspacePath, PROFILE_DIRECTORY, PLUGINS_DIRECTORY, `${name}.json`);
}

export function compileCustomPlugin(def: CustomPluginDef): HarnessPlugin {
  const pattern = new RegExp(def.match, "i");
  return {
    name: def.name,
    version: "0.1.0",
    stage: def.stage,
    priority: def.priority,
    async hook(ctx: PluginContext): Promise<PluginResult> {
      const haystack = `${ctx.normalized}\n${ctx.diff ?? ""}`;
      if (!pattern.test(haystack)) return { action: "pass" };
      if (def.action === "block") return { action: "block", reason: def.message || `${def.name}: bloqueado` };
      if (def.action === "inject-skill") return { action: "inject-skill", skillName: def.skillName };
      return { action: "transform", message: def.message };
    },
  };
}

export class CustomPluginHost {
  constructor(private readonly getWorkspace: () => string | null) {}

  private directory(): string | null {
    const workspace = this.getWorkspace();
    if (!workspace) return null;
    return join(workspace, PROFILE_DIRECTORY, PLUGINS_DIRECTORY);
  }

  list(): CustomPluginDef[] {
    const directory = this.directory();
    if (!directory || !existsSync(directory)) return [];
    const defs: CustomPluginDef[] = [];
    for (const entry of readdirSync(directory)) {
      if (!entry.endsWith(".json")) continue;
      try {
        const parsed = parseCustomPluginJson(JSON.parse(readFileSync(join(directory, entry), "utf8")));
        if (parsed) defs.push(parsed);
      } catch {
        continue;
      }
    }
    return defs.sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name));
  }

  load(): HarnessPlugin[] {
    return this.list().map(compileCustomPlugin);
  }

  save(def: CustomPluginDef): { ok: boolean; errors: string[] } {
    const validation = validateCustomPlugin(def);
    if (!validation.ok) return validation;
    const directory = this.directory();
    if (!directory) return { ok: false, errors: ["workspace no activo"] };
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${def.name}.json`), customPluginDefToJson(def), "utf8");
    return { ok: true, errors: [] };
  }

  delete(name: string): { ok: boolean; errors: string[] } {
    const directory = this.directory();
    if (!directory) return { ok: false, errors: ["workspace no activo"] };
    const file = join(directory, `${name}.json`);
    if (!existsSync(file)) return { ok: false, errors: ["plugin no encontrado"] };
    rmSync(file, { force: true });
    return { ok: true, errors: [] };
  }
}

export function projectTasksPath(workspacePath: string): string {
  return join(workspacePath, PROFILE_DIRECTORY, "tasks.json");
}
