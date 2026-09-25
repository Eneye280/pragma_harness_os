import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";

const messageSchema = z.string().min(1).max(20000);
const pingResponse = { status: "harness:ready" as const, version: "0.1.0" };

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("harness:ping", async () => pingResponse);

  ipcMain.handle("harness:sendMessage", async (_e, rawMessage: unknown) => {
    const parsed = messageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      return { error: "Invalid message", details: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    return { received: parsed.data, note: "ingress will handle in TASK 04", ts: Date.now() };
  });

  ipcMain.handle("harness:getSessions", async () => ({ sessions: [] }));

  ipcMain.handle("harness:health", async () => ({ status: "ok", ts: Date.now() }));
}

export function broadcastEvent(event: unknown): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send("harness:event", event);
}
