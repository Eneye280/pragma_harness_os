import { ipcMain, BrowserWindow } from "electron";

export function registerWindowControls(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("window:minimize", () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle("window:maximizeOrRestore", () => {
    const win = getMainWindow();
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });

  ipcMain.handle("window:close", () => {
    getMainWindow()?.close();
  });

  ipcMain.handle("window:isMaximized", () => getMainWindow()?.isMaximized() ?? false);
}
