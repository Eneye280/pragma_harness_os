import { ipcMain, BrowserWindow } from "electron";
import { skillCompiler } from "../harness/skills/skill-compiler";
import type { SettingsController } from "../settings";

export function registerSkillsHandlers(getMainWindow: () => BrowserWindow | null, settingsController: SettingsController): void {
  ipcMain.handle("skills:list", async () => skillCompiler.list());

  ipcMain.handle("skills:setEnabled", async (_event, rawPayload: unknown) => {
    const payload =
      rawPayload && typeof rawPayload === "object"
        ? (rawPayload as { name?: unknown; enabled?: unknown })
        : { name: undefined, enabled: undefined };
    if (typeof payload.name !== "string" || typeof payload.enabled !== "boolean") {
      return { error: "invalid payload", skills: skillCompiler.list() };
    }
    const current = settingsController.store.getGlobal().skills;
    settingsController.store.updateSkills({ ...current, [payload.name]: payload.enabled });
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("settings:changed", settingsController.get());
    return { error: null, skills: skillCompiler.list() };
  });
}
