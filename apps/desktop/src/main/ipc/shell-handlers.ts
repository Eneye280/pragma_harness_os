import { ipcMain, shell } from "electron";
import { existsSync } from "fs";
import { resolveInsideWorkspace } from "../tools/file-tools";
import type { WorkspaceFolderController } from "../workspace-folder";

/**
 * Abrir un archivo del proyecto con la app del sistema (HTML → navegador),
 * o una URL externa http/https. Todo queda validado dentro del workspace.
 */
export function registerShellHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("shell:openPath", async (_event, rawPath: unknown) => {
    const relative = typeof rawPath === "string" ? rawPath : "";
    const current = workspace.current();
    if (!current) return { error: "sin proyecto abierto" };
    if (!relative) return { error: "ruta vacía" };
    try {
      const absolute = resolveInsideWorkspace(current, relative);
      if (!existsSync(absolute)) return { error: "no existe" };
      const result = await shell.openPath(absolute);
      return result ? { error: result } : { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "no se pudo abrir" };
    }
  });

  ipcMain.handle("shell:openExternal", async (_event, rawUrl: unknown) => {
    const url = typeof rawUrl === "string" ? rawUrl : "";
    if (!/^https?:\/\//i.test(url)) return { error: "url no permitida" };
    await shell.openExternal(url);
    return { error: null };
  });
}
