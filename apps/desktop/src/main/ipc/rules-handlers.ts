import { ipcMain } from "electron";
import { addProjectRule, readProjectRules, removeProjectRule } from "../rules/project-rules";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerRulesHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("rules:list", async () => {
    return { rules: readProjectRules(workspace.current()) };
  });

  ipcMain.handle("rules:add", async (_event, rawText: unknown) => {
    const text = typeof rawText === "string" ? rawText : "";
    const current = workspace.current();
    if (!current) return { error: "sin proyecto abierto", rules: [] };
    if (!text.trim()) return { error: "regla vacía", rules: readProjectRules(current) };
    return { error: null, rules: addProjectRule(current, text) };
  });

  ipcMain.handle("rules:remove", async (_event, rawId: unknown) => {
    const id = typeof rawId === "string" ? rawId : "";
    const current = workspace.current();
    if (!current) return { error: "sin proyecto abierto", rules: [] };
    return { error: null, rules: removeProjectRule(current, id) };
  });
}
