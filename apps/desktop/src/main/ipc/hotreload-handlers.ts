import { ipcMain } from "electron";
import type { HotReloadRegistry } from "../hotreload";

export function registerHotReloadHandlers(registry: () => HotReloadRegistry | null): void {
  ipcMain.handle("hotreload:reload", async () => {
    const current = registry();
    if (!current) return { ok: false, error: "hot-reload no inicializado" };
    current.refresh();
    return { ok: true };
  });
}
