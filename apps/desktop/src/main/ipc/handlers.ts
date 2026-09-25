import { ipcMain, BrowserWindow } from "electron";
import { z } from "zod";
import { ingress } from "../harness/ingress";
import { runPipelineStub } from "../harness/pipeline/stub";
import { MemoryEventLog } from "../db/memory-event-log";

const messageSchema = z.string().min(1).max(20000);
const pingResponse = { status: "harness:ready" as const, version: "0.1.0" };

const memoryLog = new MemoryEventLog();

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("harness:ping", async () => pingResponse);

  ipcMain.handle("harness:sendMessage", async (_e, rawMessage: unknown) => {
    const parsed = messageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      return { error: "Invalid message", details: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const { context, eventId } = ingress.intercept(parsed.data);
    const harnessEvent = ingress.createHarnessEvent(context, eventId);

    memoryLog.ensureWorkspace(context.workspaceHash, context.workspacePath);
    memoryLog.append({
      type: harnessEvent.type,
      payload: harnessEvent.payload,
      sessionId: harnessEvent.sessionId,
      workspaceHash: harnessEvent.workspaceHash,
      id: harnessEvent.id,
      ts: harnessEvent.ts,
    });

    const pipeline = await runPipelineStub(context);

    const win = getMainWindow();
    if (win) win.webContents.send("harness:event", harnessEvent);

    return {
      received: context.normalized,
      sessionId: context.sessionId,
      workspaceHash: context.workspaceHash,
      eventId: harnessEvent.id,
      commands: context.commands,
      mentions: context.mentions,
      pipeline,
      note: "ingress handled — pipeline stub will be replaced in TASK 05-09",
      ts: context.timestamp,
    };
  });

  ipcMain.handle("harness:getSessions", async (_e, sessionId: unknown) => {
    if (typeof sessionId === "string") return { events: memoryLog.getBySession(sessionId) };
    return { sessions: [] };
  });

  ipcMain.handle("harness:health", async () => ({ status: "ok", ts: Date.now() }));
  ipcMain.handle("harness:getEvents", async (_e, sessionId: unknown) => {
    if (typeof sessionId === "string") return { events: memoryLog.getBySession(sessionId) };
    return { events: [] };
  });
}

export function broadcastEvent(event: unknown): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send("harness:event", event);
}
