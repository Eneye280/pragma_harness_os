import { ipcMain, type BrowserWindow } from "electron";
import type { DependencyGraphService } from "../graph/graph-service";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerGraphHandlers(
  getWindow: () => BrowserWindow | null,
  workspace: WorkspaceFolderController,
  service: DependencyGraphService
): void {
  ipcMain.handle("graph:get", async () => service.refresh(workspace.current()));
  ipcMain.handle("graph:refresh", async () => service.refresh(workspace.current()));

  const rewatch = (workspacePath: string) => {
    service.watchWorkspace(workspacePath, (delta) => {
      getWindow()?.webContents.send("graph:updated", delta);
    });
  };
  rewatch(workspace.current());
  workspace.onChange(rewatch);
}
