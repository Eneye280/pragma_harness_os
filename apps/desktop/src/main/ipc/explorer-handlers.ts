import { ipcMain, BrowserWindow } from "electron";
import { ExplorerController, ReadFileSchema } from "../explorer";
import { WorkspaceWatcher } from "../explorer/watcher";

export function registerExplorerHandlers(
  getMainWindow: () => BrowserWindow | null,
  workspacePath: string
): void {
  const controller = new ExplorerController(workspacePath);

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

  const watcher = new WorkspaceWatcher(workspacePath, {
    onChange: (paths) => {
      const win = getMainWindow();
      if (win) win.webContents.send("explorer:changed", { paths, ts: Date.now() });
    },
  });
  watcher.start();
}
