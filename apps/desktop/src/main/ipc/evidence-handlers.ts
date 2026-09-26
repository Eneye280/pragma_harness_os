import { ipcMain } from "electron";
import { z } from "zod";
import { ensureEvidenceIgnored, saveEvidence } from "../evidence/evidence-store";
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

export function registerEvidenceHandlers(workspace: WorkspaceFolderController): void {
  ipcMain.handle("evidence:save", async (_event, rawPayload: unknown) => {
    const payload = z.object({ task: z.string().min(1).max(120), dataUrl: z.string().min(1) }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid payload" };
    const workspacePath = workspace.current();
    if (!workspacePath) return { ok: false, error: "workspace no activo" };
    const buffer = dataUrlToBuffer(payload.data.dataUrl);
    if (!buffer) return { ok: false, error: "sólo PNG en data URL" };
    const ignored = ensureEvidenceIgnored(workspacePath);
    const saved = saveEvidence(workspacePath, payload.data.task, buffer);
    return { ok: true, path: saved.path, bytes: saved.bytes, gitignored: ignored };
  });
}
