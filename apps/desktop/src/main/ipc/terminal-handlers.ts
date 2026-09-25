import { ipcMain, BrowserWindow } from "electron";
import { TerminalService } from "../terminal";

export function registerTerminalHandlers(getMainWindow: () => BrowserWindow | null, workspacePath: string): void {
  const service = new TerminalService({ workspacePath });

  ipcMain.handle("terminal:start", async () => ({
    cwd: service.workingDirectory,
    banner: service.banner(),
  }));

  ipcMain.handle("terminal:write", async (_event, rawLine: unknown) => {
    if (typeof rawLine !== "string" || rawLine.length > 4000) return { error: "invalid line" };
    const emit = (data: string) => {
      const win = getMainWindow();
      if (win) win.webContents.send("terminal:data", { data });
    };
    await service.run(rawLine, emit);
    return { ok: true };
  });
}
