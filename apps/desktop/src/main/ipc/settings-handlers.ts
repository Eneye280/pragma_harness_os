import { ipcMain, BrowserWindow } from "electron";
import { SettingsSchema } from "../settings/settings-store";
import type { SettingsController } from "../settings";
import type { HarnessSettings } from "../../shared/settings";

export function registerSettingsHandlers(getMainWindow: () => BrowserWindow | null, controller: SettingsController): void {
  ipcMain.handle("settings:get", async () => controller.get());

  ipcMain.handle("settings:update", async (_event, incoming: unknown) => {
    const result = SettingsSchema.safeParse(incoming);
    if (!result.success) {
      return { error: result.error.issues.map((issue) => issue.path.join(".")).join(", ") };
    }
    const saved = controller.update(result.data as HarnessSettings);
    const win = getMainWindow();
    if (win) win.webContents.send("settings:changed", saved);
    return saved;
  });

  ipcMain.handle("settings:resolved", async () => controller.resolved());
  ipcMain.handle("settings:testProvider", async () => controller.testProvider());
}
