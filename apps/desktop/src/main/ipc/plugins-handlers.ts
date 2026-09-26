import { ipcMain, BrowserWindow } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { CustomPluginHost, projectTasksPath } from "../plugins/custom";
import { validateProjectTasks, type CustomPluginDef, type ProjectTask } from "../../shared/plugin-authoring";
import type { SettingsController } from "../settings";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerPluginsHandlers(
  getMainWindow: () => BrowserWindow | null,
  workspace: WorkspaceFolderController,
  settingsController: SettingsController
): void {
  const host = new CustomPluginHost(() => workspace.current());

  ipcMain.handle("plugins:list", async () => ({ custom: host.list() }));

  ipcMain.handle("plugins:save", async (_event, rawPayload: unknown) => {
    const def = rawPayload as CustomPluginDef;
    const result = host.save(def);
    if (!result.ok) return { ok: false, errors: result.errors, custom: host.list() };
    const plugins = { ...settingsController.store.getGlobal().plugins, [def.name]: true };
    settingsController.store.updatePlugins(plugins);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("settings:changed", settingsController.get());
    return { ok: true, errors: [], custom: host.list() };
  });

  ipcMain.handle("plugins:delete", async (_event, rawName: unknown) => {
    if (typeof rawName !== "string") return { ok: false, errors: ["invalid payload"], custom: host.list() };
    const result = host.delete(rawName);
    const plugins = { ...settingsController.store.getGlobal().plugins };
    delete plugins[rawName];
    settingsController.store.updatePlugins(plugins);
    return { ok: result.ok, errors: result.errors, custom: host.list() };
  });

  ipcMain.handle("tasks:list", async () => {
    const workspacePath = workspace.current();
    if (!workspacePath) return { tasks: [] as ProjectTask[] };
    const file = projectTasksPath(workspacePath);
    if (!existsSync(file)) return { tasks: [] as ProjectTask[] };
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      return { tasks: Array.isArray(parsed) ? (parsed as ProjectTask[]) : [] };
    } catch {
      return { tasks: [] as ProjectTask[] };
    }
  });

  ipcMain.handle("tasks:save", async (_event, rawPayload: unknown) => {
    const workspacePath = workspace.current();
    if (!workspacePath) return { ok: false, errors: ["workspace no activo"], tasks: [] };
    const tasks = Array.isArray((rawPayload as { tasks?: unknown } | null)?.tasks) ? ((rawPayload as { tasks: ProjectTask[] }).tasks) : null;
    if (!tasks) return { ok: false, errors: ["invalid payload"], tasks: [] };
    const validation = validateProjectTasks(tasks);
    if (!validation.ok) return { ok: false, errors: validation.errors, tasks };
    const file = projectTasksPath(workspacePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
    return { ok: true, errors: [], tasks };
  });
}
