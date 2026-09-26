import { ipcMain, BrowserWindow } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { skillCompiler } from "../harness/skills/skill-compiler";
import { parseSkillDoc, serializeSkillDoc, validateSkillDoc } from "../../shared/skill-authoring";
import type { SettingsController } from "../settings";
import type { WorkspaceFolderController } from "../workspace-folder";

type Scope = "project" | "global";

function globalRoot(): string {
  const repo = join(process.cwd(), "..", "..");
  return existsSync(join(repo, "skills")) || existsSync(join(repo, ".git")) ? repo : process.cwd();
}

function skillFile(root: string, name: string): { directory: string; file: string } {
  const directory = join(root, "skills", name);
  return { directory, file: join(directory, "SKILL.md") };
}

export function registerSkillsHandlers(
  getMainWindow: () => BrowserWindow | null,
  settingsController: SettingsController,
  workspace: WorkspaceFolderController
): void {
  function resolveRoot(scope: Scope): string | null {
    if (scope === "global") return globalRoot();
    return workspace.current() ?? null;
  }

  ipcMain.handle("skills:list", async () => skillCompiler.list());

  ipcMain.handle("skills:setEnabled", async (_event, rawPayload: unknown) => {
    const payload =
      rawPayload && typeof rawPayload === "object"
        ? (rawPayload as { name?: unknown; enabled?: unknown })
        : { name: undefined, enabled: undefined };
    if (typeof payload.name !== "string" || typeof payload.enabled !== "boolean") {
      return { error: "invalid payload", skills: skillCompiler.list() };
    }
    const current = settingsController.store.getGlobal().skills;
    settingsController.store.updateSkills({ ...current, [payload.name]: payload.enabled });
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("settings:changed", settingsController.get());
    return { error: null, skills: skillCompiler.list() };
  });

  ipcMain.handle("skills:validate", async (_event, rawContent: unknown) => {
    if (typeof rawContent !== "string") return { ok: false, errors: ["contenido inválido"], warnings: [] };
    return validateSkillDoc(rawContent);
  });

  ipcMain.handle("skills:get", async (_event, rawPayload: unknown) => {
    const payload = rawPayload as { name?: unknown } | null;
    if (!payload || typeof payload.name !== "string") return { ok: false, error: "invalid payload" };
    const entry = skillCompiler.list().find((skill) => skill.name === payload.name);
    if (!entry) return { ok: false, error: "skill no encontrada" };
    try {
      const content = readFileSync(entry.path, "utf8");
      const scope: Scope = workspace.current() && entry.path.startsWith(join(workspace.current() ?? "", "skills")) ? "project" : "global";
      return { ok: true, content, path: entry.path, scope };
    } catch {
      return { ok: false, error: "no se pudo leer la skill" };
    }
  });

  ipcMain.handle("skills:save", async (_event, rawPayload: unknown) => {
    const payload = rawPayload as { name?: unknown; content?: unknown; scope?: unknown } | null;
    if (!payload || typeof payload.content !== "string") return { ok: false, error: "invalid payload", skills: skillCompiler.list() };
    const validation = validateSkillDoc(payload.content);
    if (!validation.ok) return { ok: false, error: "validación fallida", errors: validation.errors, warnings: validation.warnings, skills: skillCompiler.list() };
    const parsed = parseSkillDoc(payload.content);
    const name = (typeof payload.name === "string" && payload.name.trim()) || parsed.frontmatter.name;
    const scope: Scope = payload.scope === "global" ? "global" : "project";
    const root = resolveRoot(scope);
    if (!root || !name) return { ok: false, error: "workspace no activo", skills: skillCompiler.list() };
    const target = skillFile(root, name);
    mkdirSync(target.directory, { recursive: true });
    writeFileSync(target.file, serializeSkillDoc({ ...parsed.frontmatter, name }, parsed.body), "utf8");
    skillCompiler.clearCache();
    return { ok: true, path: target.file, scope, errors: [] as string[], warnings: validation.warnings, skills: skillCompiler.list() };
  });

  ipcMain.handle("skills:duplicate", async (_event, rawPayload: unknown) => {
    const payload = rawPayload as { name?: unknown; newName?: unknown; scope?: unknown } | null;
    if (!payload || typeof payload.name !== "string" || typeof payload.newName !== "string") {
      return { ok: false, error: "invalid payload", skills: skillCompiler.list() };
    }
    const entry = skillCompiler.list().find((skill) => skill.name === payload.name);
    if (!entry) return { ok: false, error: "skill no encontrada", skills: skillCompiler.list() };
    const source = readFileSync(entry.path, "utf8");
    const parsed = parseSkillDoc(source);
    const content = serializeSkillDoc({ ...parsed.frontmatter, name: payload.newName.trim(), needs: [...parsed.frontmatter.needs] }, parsed.body);
    const scope: Scope = payload.scope === "global" ? "global" : "project";
    const root = resolveRoot(scope);
    if (!root) return { ok: false, error: "workspace no activo", skills: skillCompiler.list() };
    const target = skillFile(root, payload.newName.trim());
    mkdirSync(target.directory, { recursive: true });
    writeFileSync(target.file, content, "utf8");
    skillCompiler.clearCache();
    return { ok: true, path: target.file, content, skills: skillCompiler.list() };
  });

  ipcMain.handle("skills:delete", async (_event, rawPayload: unknown) => {
    const payload = rawPayload as { name?: unknown } | null;
    if (!payload || typeof payload.name !== "string") return { ok: false, error: "invalid payload", skills: skillCompiler.list() };
    const entry = skillCompiler.list().find((skill) => skill.name === payload.name);
    if (!entry) return { ok: false, error: "skill no encontrada", skills: skillCompiler.list() };
    try {
      rmSync(join(entry.path, ".."), { recursive: true, force: true });
    } catch {
      return { ok: false, error: "no se pudo borrar", skills: skillCompiler.list() };
    }
    skillCompiler.clearCache();
    return { ok: true, skills: skillCompiler.list() };
  });
}
