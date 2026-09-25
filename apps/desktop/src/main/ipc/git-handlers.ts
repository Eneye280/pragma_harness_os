import { ipcMain } from "electron";
import { GitStatusService } from "../git";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerGitHandlers(workspace: WorkspaceFolderController): void {
  const service = new GitStatusService();
  ipcMain.handle("git:status", async () => service.getStatus(workspace.current()));
}
