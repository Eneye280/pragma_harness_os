import { ipcMain } from "electron";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { listBundles, resolveBundle, validateBundle, bundleToProfile, detectStack } from "../bundles";
import type { ProjectProfileStore } from "../profile";
import type { WorkspaceFolderController } from "../workspace-folder";
import { skillCompiler } from "../harness/skills/skill-compiler";
import type { AgentCatalog } from "../agents";

function knownSkills(): string[] {
  return skillCompiler.list().map((skill) => skill.name);
}

function knownAgents(catalog: AgentCatalog): string[] {
  return catalog.list().map((agent) => agent.id);
}

export function registerBundlesHandlers(
  workspace: WorkspaceFolderController,
  profileStore: ProjectProfileStore,
  agentCatalog: AgentCatalog
): void {
  ipcMain.handle("bundles:list", async () => {
    const skills = knownSkills();
    const agents = knownAgents(agentCatalog);
    return listBundles().map((bundle) => ({ ...bundle, validation: validateBundle(bundle, skills, agents) }));
  });

  ipcMain.handle("bundles:apply", async (_event, rawStack: unknown) => {
    if (typeof rawStack !== "string") return { ok: false, error: "invalid stack" };
    const bundle = resolveBundle(rawStack);
    if (!bundle) return { ok: false, error: `stack desconocido: ${rawStack}` };
    const validation = validateBundle(bundle, knownSkills(), knownAgents(agentCatalog));
    if (!validation.ok) {
      return { ok: false, error: "bundle incompleto", validation };
    }
    const workspacePath = workspace.current();
    const current = profileStore.read(workspacePath);
    const profile = bundleToProfile(bundle, current);
    const info = profileStore.write(workspacePath, profile);
    return { ok: true, profile: info, validation };
  });

  ipcMain.handle("bundles:detect", async () => detectStack(workspace.current()));

  ipcMain.handle("bundles:scaffold", async (_event, rawStack: unknown) => {
    if (typeof rawStack !== "string") return { ok: false, error: "invalid stack" };
    const bundle = resolveBundle(rawStack);
    if (!bundle) return { ok: false, error: `stack desconocido: ${rawStack}` };
    const agentsMdPath = join(workspace.current(), "AGENTS.md");
    if (existsSync(agentsMdPath)) return { ok: true, written: false, path: agentsMdPath };
    const lines = [
      `# AGENTS.md — ${bundle.label}`,
      "",
      `Proyecto de stack **${bundle.stack}** generado por Pragma Harness OS.`,
      "",
      "## Agente por defecto",
      `- ${bundle.agent}${bundle.extraAgents?.length ? ` (+ ${bundle.extraAgents.join(", ")})` : ""}`,
      "",
      "## Skills",
      ...bundle.skills.map((skill) => `- ${skill}`),
      "",
      "## Reglas",
      "- Respeta el pipeline del harness: clasificación → reglas → skills → gates.",
      "- Los cambios del agente viven en un git worktree y se mergean tras pasar los gates.",
      "",
    ];
    writeFileSync(agentsMdPath, lines.join("\n"), "utf8");
    return { ok: true, written: true, path: agentsMdPath };
  });
}
