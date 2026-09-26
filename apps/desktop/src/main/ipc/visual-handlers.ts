import { ipcMain } from "electron";
import { existsSync } from "fs";
import { z } from "zod";
import { evaluateVisual, visualBaselinePath } from "../visual/visual-gate";
import type { WorkspaceFolderController } from "../workspace-folder";

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

export function registerVisualHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("visual:evaluate", async (_event, rawPayload: unknown) => {
    const payload = z
      .object({ name: z.string().min(1).max(120), dataUrl: z.string().min(1), threshold: z.number().min(0).max(1).optional(), updateBaseline: z.boolean().optional() })
      .safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid payload" };
    const workspacePath = workspace.current();
    if (!workspacePath) return { ok: false, error: "workspace no activo" };
    const buffer = dataUrlToBuffer(payload.data.dataUrl);
    if (!buffer) return { ok: false, error: "sólo se aceptan PNG en data URL" };
    try {
      const result = evaluateVisual(workspacePath, payload.data.name, buffer, { threshold: payload.data.threshold, updateBaseline: payload.data.updateBaseline });
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "visual gate failed" };
    }
  });

  ipcMain.handle("visual:status", async (_event, rawName: unknown) => {
    const workspacePath = workspace.current();
    if (!workspacePath || typeof rawName !== "string") return { hasBaseline: false, path: "" };
    const path = visualBaselinePath(workspacePath, rawName);
    return { hasBaseline: existsSync(path), path };
  });
}
