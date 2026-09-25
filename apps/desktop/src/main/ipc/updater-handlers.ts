import { ipcMain, BrowserWindow } from "electron";
import type { UpdaterHost } from "../updater";

export function registerUpdaterHandlers(getMainWindow: () => BrowserWindow | null, updater: UpdaterHost): void {
  updater.onStatus((status) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("updater:status", status);
  });

  ipcMain.handle("updater:getStatus", async () => updater.getStatus());
  ipcMain.handle("updater:check", async () => updater.check());
  ipcMain.handle("updater:download", async () => updater.download());
  ipcMain.handle("updater:install", async () => ({ ok: updater.install() }));
}
