import { ipcMain } from "electron";
import { hashWorkspace } from "../harness/ingress";
import type { SessionStore } from "../sessions";

export function registerSessionsHandlers(getStore: () => SessionStore): void {
  ipcMain.handle("sessions:list", async (_event, rawWorkspacePath: unknown) => {
    if (typeof rawWorkspacePath !== "string" || !rawWorkspacePath) return { sessions: [] };
    return { sessions: getStore().list(hashWorkspace(rawWorkspacePath)) };
  });

  ipcMain.handle("sessions:listAll", async () => {
    return { sessions: getStore().listAll() };
  });

  ipcMain.handle("sessions:latest", async (_event, rawWorkspacePath: unknown) => {
    if (typeof rawWorkspacePath !== "string" || !rawWorkspacePath) return { session: null };
    return { session: getStore().latest(hashWorkspace(rawWorkspacePath)) };
  });

  ipcMain.handle("sessions:get", async (_event, rawId: unknown) => {
    if (typeof rawId !== "string" || !rawId) return { session: null };
    return { session: getStore().get(rawId) };
  });

  ipcMain.handle("sessions:save", async (_event, rawPayload: unknown) => {
    const payload = rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;
    if (!payload || typeof payload.id !== "string" || typeof payload.workspacePath !== "string") {
      return { error: "invalid session payload" };
    }
    const summary = getStore().save({
      id: payload.id,
      workspacePath: payload.workspacePath,
      workspaceHash: hashWorkspace(payload.workspacePath),
      title: typeof payload.title === "string" ? payload.title : undefined,
      messageCount: typeof payload.messageCount === "number" ? payload.messageCount : undefined,
      state: payload.state,
    });
    return { error: null, session: summary };
  });

  ipcMain.handle("sessions:rename", async (_event, rawPayload: unknown) => {
    const payload = rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : null;
    if (!payload || typeof payload.id !== "string" || typeof payload.title !== "string") {
      return { error: "invalid rename payload" };
    }
    return { error: null, session: getStore().rename(payload.id, payload.title) };
  });

  ipcMain.handle("sessions:delete", async (_event, rawId: unknown) => {
    if (typeof rawId !== "string" || !rawId) return { error: "invalid id" };
    getStore().remove(rawId);
    return { error: null };
  });
}
