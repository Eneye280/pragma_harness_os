import { dialog, ipcMain, BrowserWindow } from "electron";
import type { WorkspaceFolderController } from "../workspace-folder";
import type { WorkspacePickResult } from "../../shared/workspace";

export function registerWorkspaceHandlers(
  getMainWindow: () => BrowserWindow | null,
  workspace: WorkspaceFolderController
): void {
  workspace.onChange((active) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("workspace:changed", { active, recents: workspace.recents() });
    }
  });

  ipcMain.handle("workspace:get", async () => workspace.state());

  ipcMain.handle("workspace:pick", async (): Promise<WorkspacePickResult> => {
    const win = getMainWindow();
    const baseOptions = { title: "Abrir carpeta", properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory"> };
    const result = win ? await dialog.showOpenDialog(win, baseOptions) : await dialog.showOpenDialog(baseOptions);
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, state: workspace.state() };
    }
    try {
      return { canceled: false, state: workspace.activate(result.filePaths[0]) };
    } catch (error) {
      return { canceled: false, state: workspace.state(), error: error instanceof Error ? error.message : "no se pudo abrir" };
    }
  });

  ipcMain.handle("workspace:activate", async (_event, rawPath: unknown) => {
    if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
      return { ok: false, error: "ruta inválida", state: workspace.state() };
    }
    try {
      return { ok: true, state: workspace.activate(rawPath) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "no se pudo abrir", state: workspace.state() };
    }
  });
}
