import { ipcMain, BrowserWindow } from "electron";
import { TerminalService } from "../terminal";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerTerminalHandlers(
  getMainWindow: () => BrowserWindow | null,
  workspace: WorkspaceFolderController
): void {
  let service = new TerminalService({ workspacePath: workspace.current() });

  workspace.onChange((workspacePath) => {
    service = new TerminalService({ workspacePath });
  });

  ipcMain.handle("terminal:start", async () => ({
    cwd: service.workingDirectory,
    banner: service.banner(),
  }));

  ipcMain.handle("terminal:write", async (_event, rawLine: unknown) => {
    if (typeof rawLine !== "string" || rawLine.length > 4000) return { error: "invalid line" };
    const emit = (data: string) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send("terminal:data", { data });
    };
    await service.run(rawLine, emit);
    return { ok: true };
  });
}
