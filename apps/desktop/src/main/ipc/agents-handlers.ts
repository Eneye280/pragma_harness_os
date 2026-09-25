import { ipcMain, BrowserWindow } from "electron";
import type { AgentCatalog } from "../agents";
import type { SettingsController } from "../settings";

export function registerAgentsHandlers(
  getMainWindow: () => BrowserWindow | null,
  settingsController: SettingsController,
  agentCatalog: AgentCatalog
): void {
  const activeId = (): string | null => settingsController.store.getGlobal().agent || null;

  ipcMain.handle("agents:list", async () => agentCatalog.list(activeId()));

  ipcMain.handle("agents:select", async (_event, rawId: unknown) => {
    if (typeof rawId !== "string") return { error: "invalid agent id", agents: agentCatalog.list(activeId()) };
    if (rawId !== "" && !agentCatalog.get(rawId)) {
      return { error: "unknown agent", agents: agentCatalog.list(activeId()) };
    }
    settingsController.store.updateAgent(rawId);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("settings:changed", settingsController.get());
    return { error: null, agents: agentCatalog.list(activeId()) };
  });
}
