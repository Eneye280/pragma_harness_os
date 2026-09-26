import { ipcMain, type BrowserWindow } from "electron";
import { z } from "zod";
import { ragIndex } from "../harness/rag";
import type { ProjectProfileStore } from "../profile";
import type { WorkspaceFolderController } from "../workspace-folder";

export function registerRagHandlers(
  getWindow: () => BrowserWindow | null,
  profileStore: ProjectProfileStore,
  workspace: WorkspaceFolderController
): void {
  function applyProfileExcludes(): void {
    const profile = profileStore.read(workspace.current() ?? "");
    if (profile?.rag?.excludes) ragIndex.setExcludes(profile.rag.excludes);
  }

  function emitProgress(progress: { processed: number; total: number; path?: string; done: boolean }): void {
    getWindow()?.webContents.send("rag:progress", progress);
  }

  ipcMain.handle("rag:stats", async () => {
    applyProfileExcludes();
    return { size: ragIndex.size, excludes: ragIndex.getExcludes(), documents: ragIndex.listDocuments() };
  });

  ipcMain.handle("rag:recall", async (_event, rawPayload: unknown) => {
    const payload = z.object({ query: z.string().min(1).max(500), topK: z.number().int().min(1).max(20).optional() }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, hits: [] as Array<{ path: string; score: number; snippet: string }> };
    const hits = ragIndex.recall(payload.data.query, payload.data.topK ?? 5).map((hit) => ({
      path: hit.path,
      score: Number(hit.score.toFixed(3)),
      snippet: hit.snippet.replace(/\s+/g, " ").slice(0, 200),
    }));
    return { ok: true, hits };
  });

  ipcMain.handle("rag:reindex", async (_event, rawPayload: unknown) => {
    const payload = z.object({ mode: z.enum(["full", "incremental"]).optional() }).safeParse(rawPayload ?? {});
    const mode = payload.success ? payload.data.mode ?? "full" : "full";
    applyProfileExcludes();
    const before = ragIndex.size;
    const size = await ragIndex.reindex(mode, emitProgress);
    return { mode, indexed: mode === "full" ? size : size - before, size };
  });

  ipcMain.handle("rag:setExcludes", async (_event, rawPayload: unknown) => {
    const payload = z.object({ excludes: z.array(z.string().max(300)).max(50) }).safeParse(rawPayload);
    if (!payload.success) return { ok: false, error: "invalid excludes" };
    const excludes = payload.data.excludes.map((entry) => entry.trim()).filter(Boolean);
    ragIndex.setExcludes(excludes);
    const workspacePath = workspace.current();
    if (workspacePath) {
      const profile = profileStore.read(workspacePath) ?? {};
      profileStore.write(workspacePath, { ...profile, rag: { excludes } });
    }
    return { ok: true, excludes };
  });
}
