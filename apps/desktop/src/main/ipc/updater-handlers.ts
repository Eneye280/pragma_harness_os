import { ipcMain, BrowserWindow } from "electron";
import type { UpdaterHost } from "../updater";
import { fetchRelease, type FetchLike } from "../updater/feed";
import type { SettingsController } from "../settings";

export function registerUpdaterHandlers(getMainWindow: () => BrowserWindow | null, updater: UpdaterHost, settingsController: SettingsController): void {
  updater.onStatus((status) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("updater:status", status);
  });

  ipcMain.handle("updater:getStatus", async () => updater.getStatus());
  ipcMain.handle("updater:check", async () => updater.check());
  ipcMain.handle("updater:download", async () => updater.download());
  ipcMain.handle("updater:install", async () => ({ ok: updater.install() }));

  ipcMain.handle("updater:feed", async () => {
    const settings = settingsController.store.get();
    const fetchImpl: FetchLike = async (url, init) => {
      const response = await fetch(url, { headers: init?.headers });
      return { ok: response.ok, status: response.status, json: () => response.json() };
    };
    const result = await fetchRelease(
      { url: settings.updater.feedUrl, token: settings.updater.token, channel: settings.updater.channel },
      updater.getStatus().currentVersion,
      fetchImpl
    );
    return result;
  });
}
