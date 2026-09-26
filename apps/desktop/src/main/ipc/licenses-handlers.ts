import { ipcMain } from "electron";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { buildInventory } from "../licenses/inventory";
import { assessAll, buildThirdPartyMarkdown, hasBlockingLicense } from "../../shared/licenses";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerLicensesHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("licenses:inventory", async () => {
    const workspacePath = workspace.current();
    if (!workspacePath) return { entries: [], assessments: [], blocking: false };
    const entries = buildInventory(workspacePath);
    const assessments = assessAll(entries, "MIT");
    return { entries, assessments, blocking: hasBlockingLicense(assessments) };
  });

  ipcMain.handle("licenses:writeThirdParty", async () => {
    const workspacePath = workspace.current();
    if (!workspacePath) return { ok: false, error: "workspace no activo" };
    const entries = buildInventory(workspacePath);
    const path = join(workspacePath, "THIRD-PARTY.md");
    try {
      mkdirSync(workspacePath, { recursive: true });
      writeFileSync(path, buildThirdPartyMarkdown(entries), "utf8");
      return { ok: true, path, count: entries.length };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "no se pudo escribir" };
    }
  });
}
