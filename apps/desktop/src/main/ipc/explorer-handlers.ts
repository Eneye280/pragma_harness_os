import { ipcMain, BrowserWindow } from "electron";
import { ExplorerController, ReadFileSchema } from "../explorer";
import { WorkspaceWatcher } from "../explorer/watcher";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerExplorerHandlers(
  getMainWindow: () => BrowserWindow | null,
  workspace: WorkspaceFolderController
): void {
  let controller = new ExplorerController(workspace.current());

  const startWatcher = (workspacePath: string): WorkspaceWatcher => {
    const watcher = new WorkspaceWatcher(workspacePath, {
      onChange: (paths) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) win.webContents.send("explorer:changed", { paths, ts: Date.now() });
      },
    });
    watcher.start();
    return watcher;
  };

  let watcher = startWatcher(controller.workspacePath);

  ipcMain.handle("explorer:getTree", async () => controller.getTree());

  ipcMain.handle("explorer:readFile", async (_event, rawPath: unknown) => {
    const parsed = ReadFileSchema.safeParse(typeof rawPath === "string" ? { path: rawPath } : rawPath);
    if (!parsed.success) return { error: "invalid path" };
    try {
      return controller.readFile(parsed.data.path);
    } catch (readError) {
      return { error: readError instanceof Error ? readError.message : "read failed" };
    }
  });

  workspace.onChange((workspacePath) => {
    void watcher.stop();
    controller = new ExplorerController(workspacePath);
    watcher = startWatcher(workspacePath);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("explorer:changed", { paths: [], ts: Date.now() });
  });
}
